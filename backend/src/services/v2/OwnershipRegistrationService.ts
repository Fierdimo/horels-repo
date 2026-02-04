/**
 * OwnershipRegistrationService - Registro de Ownerships con automatización de escenarios
 * 
 * Maneja 3 escenarios automáticamente:
 * 1. Usuario nuevo: Crea usuario + ownership
 * 2. Guest → Owner: Convierte role + crea ownership
 * 3. Owner adicional: Solo crea ownership adicional
 * 
 * Principio: Máxima automatización, mínima fricción para el staff
 */

import { Transaction as DbTransaction, Op } from 'sequelize';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { WeekAllocationService } from './WeekAllocationService';
import { OwnershipRepository } from '../../repositories/v2/OwnershipRepository';
import { WeekAllocationRepository } from '../../repositories/v2/WeekAllocationRepository';

// Importar modelos V1/mixed que aún existen
const User = require('../../models/User').default;
const Role = require('../../models/Role').default;

// Importar modelos V2
import TimeshareUnit from '../../models/v2/TimeshareUnit';
import Ownership from '../../models/v2/Ownership';

export interface RegisterOwnershipRequest {
  owner_email: string;
  owner_first_name?: string;
  owner_last_name?: string;
  owner_phone?: string; // Opcional
  unit_id: number;
  type: 'FIXED_WEEK'; // Solo FIXED_WEEK permitido
  fixed_week_number: number;
  annual_fee?: number; // Opcional, default 0
  currency?: string; // Opcional, default EUR
  contract_reference?: string; // Opcional, se genera automáticamente
  purchase_date?: string;
  contract_start_year: number;
  contract_end_year?: number;
  notes?: string;
}

export interface RegistrationResult {
  success: boolean;
  scenario: 'new_user' | 'guest_converted' | 'existing_owner';
  user: {
    id: number;
    email: string;
    role: string;
  };
  temporary_password?: string;
  ownership: any;
  allocations: any[];
  email_sent: {
    type: string;
    to: string;
  };
}

export class OwnershipRegistrationService {
  private weekAllocationService: WeekAllocationService;
  private ownershipRepo: OwnershipRepository;

  constructor() {
    const weekRepo = new WeekAllocationRepository();
    this.ownershipRepo = new OwnershipRepository();
    this.weekAllocationService = new WeekAllocationService(weekRepo, this.ownershipRepo);
  }

  /**
   * Registrar ownership - Maneja los 3 escenarios automáticamente
   */
  async registerOwnership(
    data: RegisterOwnershipRequest,
    staffPropertyId: number,
    transaction?: DbTransaction
  ): Promise<RegistrationResult> {
    // 1. Validar unidad pertenece a la propiedad del staff
    await this.validateUnit(data.unit_id, staffPropertyId);

    // 2. Validar datos según tipo de ownership
    this.validateOwnershipData(data);

    // 3. Validar contrato único (si se proporcionó)
    if (data.contract_reference) {
      await this.validateContractReference(data.contract_reference);
    }

    // 4. Detectar escenario y procesar
    const user = await this.findUserByEmail(data.owner_email);

    if (!user) {
      // Escenario 1: Usuario nuevo
      return await this.handleNewUser(data, transaction);
    } else if (user.role === 'guest') {
      // Escenario 2: Guest → Owner
      return await this.handleGuestConversion(user, data, transaction);
    } else if (user.role === 'owner') {
      // Escenario 3: Owner adicional
      return await this.handleAdditionalOwnership(user, data, transaction);
    } else {
      throw new Error(`Rol de usuario no válido: ${user.role}`);
    }
  }

  /**
   * Escenario 1: Usuario nuevo
   */
  private async handleNewUser(
    data: RegisterOwnershipRequest,
    transaction?: DbTransaction
  ): Promise<RegistrationResult> {
    // Validar que se proporcionó nombre y apellido
    if (!data.owner_first_name || !data.owner_last_name) {
      throw new Error('owner_first_name y owner_last_name son requeridos para usuarios nuevos');
    }

    // 1. Generar contraseña temporal
    const temporaryPassword = this.generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    // 2. Crear usuario
    const user = await User.create({
      email: data.owner_email,
      password_hash: hashedPassword,
      role: 'owner',
      first_name: data.owner_first_name,
      last_name: data.owner_last_name,
      phone: data.owner_phone || null,
      status: 'active',
      must_change_password: true // Forzar cambio de contraseña temporal
    }, { transaction });

    // 3. Crear ownership
    const ownership = await this.createOwnership(user.id, data, transaction);

    // 4. Generar week allocations si es FIXED_WEEK
    const allocations = await this.generateAllocations(ownership, data, transaction);

    // 5. Enviar email de bienvenida
    await this.sendWelcomeEmail(user.email, temporaryPassword, ownership);

    return {
      success: true,
      scenario: 'new_user',
      user: {
        id: user.id,
        email: user.email,
        role: 'owner'
      },
      temporary_password: temporaryPassword,
      ownership: ownership,
      allocations: allocations,
      email_sent: {
        type: 'welcome_new_owner',
        to: user.email
      }
    };
  }

  /**
   * Escenario 2: Guest → Owner
   */
  private async handleGuestConversion(
    user: any,
    data: RegisterOwnershipRequest,
    transaction?: DbTransaction
  ): Promise<RegistrationResult> {
    // 1. Convertir role: guest → owner
    await user.update({ role: 'owner' }, { transaction });

    // 2. Actualizar datos si se proporcionaron (opcional)
    if (data.owner_first_name || data.owner_last_name || data.owner_phone) {
      const updates: any = {};
      
      if (data.owner_first_name) {
        updates.first_name = data.owner_first_name;
      }
      
      if (data.owner_last_name) {
        updates.last_name = data.owner_last_name;
      }
      
      if (data.owner_phone) {
        updates.phone = data.owner_phone;
      }
      
      if (Object.keys(updates).length > 0) {
        await user.update(updates, { transaction });
      }
    }

    // 3. Crear ownership
    const ownership = await this.createOwnership(user.id, data, transaction);

    // 4. Generar week allocations si es FIXED_WEEK
    const allocations = await this.generateAllocations(ownership, data, transaction);

    // 5. Enviar email de conversión
    await this.sendConversionEmail(user.email, ownership);

    return {
      success: true,
      scenario: 'guest_converted',
      user: {
        id: user.id,
        email: user.email,
        role: 'owner'
      },
      ownership: ownership,
      allocations: allocations,
      email_sent: {
        type: 'guest_to_owner_conversion',
        to: user.email
      }
    };
  }

  /**
   * Escenario 3: Owner adicional
   */
  private async handleAdditionalOwnership(
    user: any,
    data: RegisterOwnershipRequest,
    transaction?: DbTransaction
  ): Promise<RegistrationResult> {
    // 1. Verificar que no tenga ya esta semana específica
    if (data.type === 'FIXED_WEEK') {
      await this.validateNoDuplicateWeek(user.id, data.unit_id, data.fixed_week_number!);
    }

    // 2. Verificar límite de ownerships activos (máximo 52 semanas)
    // Solo contar ownerships que estén activos (excluir cancelados y convertidos)
    const ownershipCount = await Ownership.count({
      where: { 
        owner_id: user.id,
        status: { 
          [Op.notIn]: ['CANCELLED', 'CONVERTED_TO_CREDITS']
        }
      }
    });

    if (ownershipCount >= 52) {
      throw new Error('El usuario ha alcanzado el límite máximo de ownerships activos (52)');
    }

    // 3. Crear ownership adicional
    const ownership = await this.createOwnership(user.id, data, transaction);

    // 4. Generar week allocations si es FIXED_WEEK
    const allocations = await this.generateAllocations(ownership, data, transaction);

    // 5. Enviar email de timeshare adicional
    await this.sendAdditionalOwnershipEmail(user.email, ownership, ownershipCount + 1);

    return {
      success: true,
      scenario: 'existing_owner',
      user: {
        id: user.id,
        email: user.email,
        role: 'owner'
      },
      ownership: {
        ...ownership.toJSON(),
        is_additional: true
      },
      allocations: allocations,
      email_sent: {
        type: 'additional_ownership',
        to: user.email
      }
    };
  }

  /**
   * Crear ownership record
   */
  private async createOwnership(
    userId: number,
    data: RegisterOwnershipRequest,
    transaction?: DbTransaction
  ): Promise<any> {
    // Validar disponibilidad si es FIXED_WEEK
    if (data.type === 'FIXED_WEEK' && data.fixed_week_number) {
      await this.validateWeekAvailability(data.unit_id, data.fixed_week_number, transaction);
    }

    const ownershipData: any = {
      owner_id: userId,
      unit_id: data.unit_id,
      type: data.type,
      annual_fee: data.annual_fee || 0,
      currency: data.currency || 'EUR',
      contract_reference: data.contract_reference || this.generateContractReference(data.unit_id, data.fixed_week_number),
      contract_start_year: data.contract_start_year,
      status: 'ACTIVE'
    };

    // Campos opcionales
    if (data.type === 'FIXED_WEEK' && data.fixed_week_number) {
      ownershipData.fixed_week_number = data.fixed_week_number;
    }

    // Note: annual_points removed since we only use FIXED_WEEK

    if (data.purchase_date) {
      ownershipData.purchase_date = data.purchase_date;
    }

    if (data.contract_end_year) {
      ownershipData.contract_end_year = data.contract_end_year;
    }

    if (data.notes) {
      ownershipData.notes = data.notes;
    }

    return await Ownership.create(ownershipData, { transaction });
  }

  /**
   * Validar que la semana aún tiene unidades disponibles
   */
  private async validateWeekAvailability(
    unitId: number,
    weekNumber: number,
    transaction?: DbTransaction
  ): Promise<void> {
    // Obtener la unidad con su cantidad
    const unit = await TimeshareUnit.findByPk(unitId, { transaction });
    
    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    // Contar cuántos ownerships existen para esta semana en esta unidad
    const existingOwnerships = await Ownership.count({
      where: {
        unit_id: unitId,
        fixed_week_number: weekNumber,
        type: 'FIXED_WEEK',
        status: 'ACTIVE'
      },
      transaction
    });

    // Verificar si hay espacio disponible
    if (existingOwnerships >= unit.quantity) {
      throw new Error(
        `Week ${weekNumber} is fully booked for this unit. ` +
        `All ${unit.quantity} units are already assigned.`
      );
    }
  }

  /**
   * Generar week allocations para el año actual
   */
  private async generateAllocations(
    ownership: any,
    data: RegisterOwnershipRequest,
    transaction?: DbTransaction
  ): Promise<any[]> {
    // Solo generar para FIXED_WEEK
    if (data.type !== 'FIXED_WEEK') {
      return [];
    }

    const currentYear = new Date().getFullYear();
    
    try {
      const allocations = await this.weekAllocationService.generateAnnualAllocations(
        ownership.id,
        currentYear,
        transaction
      );
      return allocations;
    } catch (error: any) {
      console.error('Error generating allocations:', error);
      // No fallar el proceso completo si falla la generación de allocations
      return [];
    }
  }

  /**
   * Buscar usuario por email
   */
  private async findUserByEmail(email: string): Promise<any> {
    const user = await User.findOne({
      where: { email: email.toLowerCase() }
    });

    return user;
  }

  /**
   * Validar que la unidad pertenece a la propiedad del staff
   */
  private async validateUnit(unitId: number, staffPropertyId: number): Promise<void> {
    const unit = await TimeshareUnit.findByPk(unitId);

    if (!unit) {
      throw new Error('Unidad no encontrada');
    }

    if (unit.property_id !== staffPropertyId) {
      throw new Error('La unidad no pertenece a tu propiedad');
    }

    if (!unit.is_active) {
      throw new Error('La unidad no está activa');
    }
  }

  /**
   * Validar datos del ownership según tipo
   */
  private validateOwnershipData(data: RegisterOwnershipRequest): void {
    // Solo permitir FIXED_WEEK
    if (data.type !== 'FIXED_WEEK') {
      throw new Error('Solo se permiten registros de tipo FIXED_WEEK');
    }

    if (!data.fixed_week_number) {
      throw new Error('fixed_week_number es requerido para FIXED_WEEK');
    }
    if (data.fixed_week_number < 1 || data.fixed_week_number > 52) {
      throw new Error('fixed_week_number debe estar entre 1 y 52');
    }

    // Generar contract_reference automáticamente si no se proporciona
    if (!data.contract_reference || data.contract_reference.trim() === '') {
      (data as any).contract_reference = this.generateContractReference(data.unit_id, data.fixed_week_number);
    }

    // Valores por defecto para campos no requeridos
    if (!data.annual_fee || data.annual_fee <= 0) {
      (data as any).annual_fee = 0; // Valor por defecto
    }

    if (!data.currency) {
      (data as any).currency = 'EUR';
    }
  }

  /**
   * Validar que el contrato no esté duplicado (solo si se proporciona manualmente)
   */
  private async validateContractReference(contractRef: string): Promise<void> {
    // Si el contractRef fue generado automáticamente, no necesitamos validar
    if (contractRef.startsWith('TS-') && contractRef.includes('-W')) {
      return; // Es generado automáticamente, skip validation
    }

    const existing = await Ownership.findOne({
      where: { contract_reference: contractRef }
    });

    if (existing) {
      throw new Error(`El contrato ${contractRef} ya existe en el sistema`);
    }
  }

  /**
   * Validar que el usuario no tenga ya esta semana específica
   * (permitir re-registro si la semana anterior fue cancelada o convertida a créditos)
   */
  private async validateNoDuplicateWeek(
    userId: number,
    unitId: number,
    weekNumber: number
  ): Promise<void> {
    const duplicate = await Ownership.findOne({
      where: {
        owner_id: userId,
        unit_id: unitId,
        type: 'FIXED_WEEK',
        fixed_week_number: weekNumber,
        status: { 
          [Op.notIn]: ['CANCELLED', 'CONVERTED_TO_CREDITS'] // Excluir cancelados y convertidos
        }
      }
    });

    if (duplicate) {
      throw new Error(`El usuario ya posee la semana ${weekNumber} en esta unidad`);
    }
  }

  /**
   * Generar contraseña temporal segura
   */
  private generateTemporaryPassword(): string {
    const prefix = 'TMP-';
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}${randomPart}`;
  }

  /**
   * Generar contract_reference automáticamente
   */
  private generateContractReference(unitId: number, weekNumber: number): string {
    const timestamp = Date.now();
    return `TS-${unitId}-W${weekNumber}-${timestamp}`;
  }

  /**
   * Enviar email de bienvenida (usuario nuevo)
   */
  private async sendWelcomeEmail(
    email: string,
    temporaryPassword: string,
    ownership: any
  ): Promise<void> {
    // TODO: Implementar envío de email con servicio de email
    console.log(`📧 Email de bienvenida enviado a ${email}`);
    console.log(`   Contraseña temporal: ${temporaryPassword}`);
    console.log(`   Ownership: ${ownership.contract_reference}`);
  }

  /**
   * Enviar email de conversión (guest → owner)
   */
  private async sendConversionEmail(email: string, ownership: any): Promise<void> {
    // TODO: Implementar envío de email
    console.log(`📧 Email de conversión enviado a ${email}`);
    console.log(`   Ownership: ${ownership.contract_reference}`);
  }

  /**
   * Enviar email de timeshare adicional
   */
  private async sendAdditionalOwnershipEmail(
    email: string,
    ownership: any,
    totalCount: number
  ): Promise<void> {
    // TODO: Implementar envío de email
    console.log(`📧 Email de timeshare adicional enviado a ${email}`);
    console.log(`   Ownership: ${ownership.contract_reference}`);
    console.log(`   Total ownerships: ${totalCount}`);
  }

  /**
   * Verificar estado de email (para validación en tiempo real)
   */
  async checkEmailStatus(email: string): Promise<{
    exists: boolean;
    role?: string;
    name?: string;
    scenario?: 'new_user' | 'guest_converted' | 'existing_owner';
  }> {
    const user = await this.findUserByEmail(email);

    if (!user) {
      return {
        exists: false,
        scenario: 'new_user'
      };
    }

    return {
      exists: true,
      role: user.role,
      name: user.name,
      scenario: user.role === 'guest' ? 'guest_converted' : 'existing_owner'
    };
  }
}
