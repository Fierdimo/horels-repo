/**
 * Base Repository (V2)
 * 
 * Generic repository interface with common CRUD operations.
 * All V2 repositories extend this interface.
 * 
 * Benefits:
 * - Abstraction: Controllers don't know about Sequelize
 * - Testability: Easy to mock repositories
 * - Consistency: All repos have same interface
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Architecture (Dependency Inversion)
 */

import { Model, ModelStatic, FindOptions, CreateOptions, UpdateOptions, DestroyOptions } from 'sequelize';

export interface IBaseRepository<T extends Model> {
  /**
   * Find record by primary key
   */
  findById(id: number | bigint, options?: FindOptions): Promise<T | null>;
  
  /**
   * Find one record matching criteria
   */
  findOne(options: FindOptions): Promise<T | null>;
  
  /**
   * Find all records matching criteria
   */
  findAll(options?: FindOptions): Promise<T[]>;
  
  /**
   * Find records with pagination
   */
  findAndCountAll(options?: FindOptions): Promise<{ rows: T[]; count: number }>;
  
  /**
   * Create new record
   */
  create(data: Partial<T>, options?: CreateOptions): Promise<T>;
  
  /**
   * Bulk create multiple records
   */
  bulkCreate(data: Partial<T>[], options?: CreateOptions): Promise<T[]>;
  
  /**
   * Update record by primary key
   */
  update(id: number | bigint, data: Partial<T>, options?: UpdateOptions): Promise<T | null>;
  
  /**
   * Delete record by primary key
   */
  delete(id: number | bigint, options?: DestroyOptions): Promise<boolean>;
  
  /**
   * Count records matching criteria
   */
  count(options?: FindOptions): Promise<number>;
  
  /**
   * Check if record exists
   */
  exists(options: FindOptions): Promise<boolean>;
}

/**
 * Base Repository Implementation
 */
export abstract class BaseRepository<T extends Model> implements IBaseRepository<T> {
  protected model: ModelStatic<T>;
  
  constructor(model: ModelStatic<T>) {
    this.model = model;
  }
  
  async findById(id: number | bigint, options?: FindOptions): Promise<T | null> {
    return this.model.findByPk(id, options);
  }
  
  async findOne(options: FindOptions): Promise<T | null> {
    return this.model.findOne(options);
  }
  
  async findAll(options?: FindOptions): Promise<T[]> {
    return this.model.findAll(options);
  }
  
  async findAndCountAll(options?: FindOptions): Promise<{ rows: T[]; count: number }> {
    return this.model.findAndCountAll(options);
  }
  
  async create(data: any, options?: CreateOptions): Promise<T> {
    return this.model.create(data, options);
  }
  
  async bulkCreate(data: any[], options?: CreateOptions): Promise<T[]> {
    return this.model.bulkCreate(data, options);
  }
  
  async update(id: number | bigint, data: any, options?: UpdateOptions): Promise<T | null> {
    const record = await this.findById(id);
    if (!record) {
      return null;
    }
    await record.update(data, options);
    return record;
  }
  
  async delete(id: number | bigint, options?: DestroyOptions): Promise<boolean> {
    const deleted = await this.model.destroy({
      where: { id } as any,
      ...options,
    });
    return deleted > 0;
  }
  
  async count(options?: FindOptions): Promise<number> {
    return this.model.count(options);
  }
  
  async exists(options: FindOptions): Promise<boolean> {
    const count = await this.model.count(options);
    return count > 0;
  }
}

export default BaseRepository;
