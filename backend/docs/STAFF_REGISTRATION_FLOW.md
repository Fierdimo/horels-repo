# Flujo de Registro de Staff con PMS

## Problema Solucionado
Antes, el staff podía crear hoteles manualmente con datos inconsistentes. Ahora, **solo pueden registrarse con hoteles que existan en un PMS**, garantizando:
- ✅ Datos consistentes del hotel
- ✅ Captura automática del `pms_property_id`
- ✅ Credenciales PMS válidas desde el inicio
- ✅ Integración inmediata con el PMS

## Flujo de Registro para Staff

### 1. **Seleccionar Proveedor de PMS**
```http
GET /hotels/pms-search/providers
```

**Respuesta:**
```json
{
  "success": true,
  "data": [
    { "value": "mews", "label": "Mews PMS", "requiresAuth": true },
    { "value": "cloudbeds", "label": "Cloudbeds", "requiresAuth": true },
    { "value": "opera", "label": "Oracle Opera", "requiresAuth": true },
    { "value": "resnexus", "label": "ResNexus", "requiresAuth": true }
  ]
}
```

### 2. **Buscar Hotel en el PMS (Autocomplete)**
```http
POST /hotels/pms-search/properties
Content-Type: application/json

{
  "provider": "mews",
  "credentials": {
    "clientToken": "xxx",
    "accessToken": "yyy"
  },
  "search": "Grand Hotel"  // Opcional, para filtrar
}
```

**Respuesta:**
```json
{
  "success": true,
  "data": {
    "propertyId": "property-demo-madrid-001",
    "name": "Grand Hotel Madrid",
    "address": "Calle Gran Via 123",
    "city": "Madrid",
    "country": "Spain",
    "timezone": "Europe/Madrid",
    "alreadyRegistered": false,
    "existingPropertyId": null
  }
}
```

### 3. **Validar Hotel (Opcional, antes de registro)**
```http
POST /hotels/pms-search/validate-property
Content-Type: application/json

{
  "provider": "mews",
  "credentials": {
    "clientToken": "xxx",
    "accessToken": "yyy"
  },
  "propertyId": "property-demo-madrid-001"
}
```

**Respuesta si disponible:**
```json
{
  "success": true,
  "data": {
    "propertyId": "property-demo-madrid-001",
    "name": "Grand Hotel Madrid",
    "address": "Calle Gran Via 123",
    "city": "Madrid",
    "country": "Spain",
    "timezone": "Europe/Madrid",
    "canRegister": true
  }
}
```

**Respuesta si ya está registrado:**
```json
{
  "success": false,
  "error": "Property already registered in the system",
  "propertyId": 4,
  "propertyName": "Grand Hotel Madrid",
  "status": "active"
}
```

### 4. **Registrar Staff con Hotel del PMS**
```http
POST /hotels/auth/register
Content-Type: application/json

{
  "email": "staff@grandhotel.com",
  "password": "securePassword123",
  "roleName": "staff",
  "pms_provider": "mews",
  "pms_property_id": "property-demo-madrid-001",
  "pms_credentials": {
    "clientToken": "xxx",
    "accessToken": "yyy"
  },
  "property_data": {
    "name": "Grand Hotel Madrid",
    "city": "Madrid",
    "country": "Spain",
    "address": "Calle Gran Via 123",
    "timezone": "Europe/Madrid",
    "description": "Luxury hotel..."
  }
}
```

**Respuesta:**
```json
{
  "message": "Registration submitted. Waiting for admin approval.",
  "userId": 16,
  "status": "pending",
  "propertyId": 13
}
```

## Estados del Registro

### Caso 1: Hotel Nuevo en el Sistema
- Se crea automáticamente la `Property` con:
  - `status: 'pending_verification'`
  - `pms_verified: false`
  - Credenciales PMS encriptadas
  - Datos del hotel desde el PMS
- Usuario creado con `status: 'pending'`
- **Requiere aprobación del admin**

### Caso 2: Hotel Ya Existe, Sin Staff
- Property ya existe en el sistema
- Se asigna el `property_id` al usuario
- Usuario creado con `status: 'pending'`
- **Requiere aprobación del admin**

### Caso 3: Hotel Ya Existe, Con Staff
- Property ya tiene staff asignado
- **Registro rechazado**
- Error: "This property already has staff registered"

## Validaciones Implementadas

✅ **Provider requerido**: Debe seleccionar un PMS (no puede ser 'none')  
✅ **Property ID requerido**: Debe venir del PMS  
✅ **Credenciales requeridas**: Se validan conectando al PMS  
✅ **Property data requerida**: Mínimo nombre, ciudad, país  
✅ **Unicidad de property**: Un hotel del PMS solo puede registrarse una vez  
✅ **Unicidad de staff**: Un hotel solo puede tener un staff (primera vez)  

## Seguridad

- ✅ Credenciales PMS encriptadas con AES-256-GCM antes de guardar
- ✅ Validación de conexión al PMS antes de aceptar el registro
- ✅ Admin debe aprobar nuevos staff antes de darles acceso
- ✅ Properties quedan en `pending_verification` hasta que admin las active

## Interfaz de Usuario Sugerida

### Frontend - Formulario de Registro Staff

1. **Paso 1**: Seleccionar PMS provider (dropdown)
2. **Paso 2**: Ingresar credenciales del PMS
3. **Paso 3**: Autocomplete para buscar hotel (llama a `/pms-search/properties`)
   - Muestra: Nombre, Ciudad, País
   - Si `alreadyRegistered=true`, mostrar mensaje de error
4. **Paso 4**: Confirmar datos del hotel
5. **Paso 5**: Ingresar email y password del staff
6. **Paso 6**: Enviar registro y mostrar estado pending

### Ejemplo de Autocomplete

```jsx
<Autocomplete
  options={hotels}
  getOptionLabel={(option) => `${option.name} - ${option.city}, ${option.country}`}
  renderOption={(props, option) => (
    <li {...props}>
      <div>
        <div>{option.name}</div>
        <small>{option.city}, {option.country}</small>
        {option.alreadyRegistered && <span>⚠️ Already registered</span>}
      </div>
    </li>
  )}
  onInputChange={(event, value) => {
    // Debounced call to /pms-search/properties
    searchPMSProperties(value);
  }}
  onChange={(event, value) => {
    setSelectedHotel(value);
  }}
/>
```

## Beneficios

✅ **Datos consistentes**: Hotel siempre viene del PMS  
✅ **Integración inmediata**: PMS configurado desde el registro  
✅ **Sin duplicados**: Validación de property_id único  
✅ **Mejor UX**: Autocomplete en lugar de formulario manual  
✅ **Seguridad**: Admin aprueba antes de dar acceso  
