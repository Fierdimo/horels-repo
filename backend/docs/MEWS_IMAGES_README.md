# Mews Images Integration

## Overview

Este documento describe cómo se obtienen y sirven imágenes de habitaciones desde el PMS Mews en el sistema de marketplace.

## Architecture

### 1. Mews Data Structure

Mews organiza las imágenes así:

```
ResourceCategoryImageAssignments
├── CategoryId (Resource Category - tipo de habitación)
├── ImageId (identificador único de imagen)
└── Ordering (posición en galería)

ResourceCategoryAssignments
├── ResourceId (habitación específica)
├── CategoryId (categoría a la que pertenece)
└── IsActive

Images API
└── Retorna URLs de imágenes redimensionadas
```

### 2. Data Flow

```
1. enrichRooms() en RoomEnrichmentService
   ↓
2. Obtener resourceCategoryImageAssignments
   (mapea CategoryId → ImageId[])
   ↓
3. Obtener resourceCategoryAssignments
   (mapea ResourceId → CategoryId[])
   ↓
4. Obtener URLs de imágenes con images/getUrls
   (ImageId[] → URL[])
   ↓
5. Mapear URLs a cada habitación
   (ResourceId → URL[])
   ↓
6. Retornar habitaciones con imágenes en array
```

## Implementation Details

### MewsAdapter Methods

#### `resourceCategoryImageAssignmentsGetAll()`

Obtiene todas las asignaciones de imágenes a categorías de recursos.

**Endpoint:** `POST /api/connector/v1/resourceCategoryImageAssignments/getAll`

**Request:**
```json
{
  "ClientToken": "...",
  "AccessToken": "...",
  "Client": "SW2-Connector",
  "Limitation": { "Count": 500 }
}
```

**Response:**
```json
{
  "ResourceCategoryImageAssignments": [
    {
      "Id": "edb5f556-7afb-4650-8d4e-8c0a6fff784d",
      "CategoryId": "773d5e42-de1e-43a0-9ce6-f940faf2303f",
      "ImageId": "e910d008-fded-4af5-a84f-c00f92e3947d",
      "Ordering": 0
    }
  ]
}
```

#### `resourceCategoryAssignmentsGetAll()`

Obtiene todas las asignaciones de recursos a categorías.

**Endpoint:** `POST /api/connector/v1/resourceCategoryAssignments/getAll`

**Request:**
```json
{
  "ClientToken": "...",
  "AccessToken": "...",
  "Client": "SW2-Connector",
  "Limitation": { "Count": 500 }
}
```

**Response:**
```json
{
  "ResourceCategoryAssignments": [
    {
      "Id": "fb69fc51-c4e9-4ef6-874a-24bcfe74a894",
      "ResourceId": "e5a34a69-d35e-4e85-a645-a9bc4ee3a80f",
      "CategoryId": "5c0804f9-d03a-4b13-a57d-b00300781a41",
      "IsActive": true
    }
  ]
}
```

#### `imagesGetUrls(imageIds, width, height, resizeMode)`

Obtiene URLs CDN redimensionadas de imágenes.

**Endpoint:** `POST /api/connector/v1/images/getUrls`

**Parameters:**
- `imageIds` (string[]): Lista de ImageIds
- `width` (number, default: 600): Ancho en pixels
- `height` (number, default: 400): Alto en pixels
- `resizeMode` (string, default: "Fit"): Modo de redimensionamiento
  - `Fit`: Redimensiona para caber sin distorsión
  - `FitExact`: Rellena para tamaño exacto
  - `Cover`: Cubre el área especificada
  - `CoverExact`: Cubre y rellena exactamente

**Request:**
```json
{
  "ClientToken": "...",
  "AccessToken": "...",
  "Client": "SW2-Connector",
  "Images": [
    {
      "ImageId": "e910d008-fded-4af5-a84f-c00f92e3947d",
      "Width": 600,
      "Height": 400,
      "ResizeMode": "Fit"
    }
  ]
}
```

**Response:**
```json
{
  "ImageUrls": [
    {
      "ImageId": "e910d008-fded-4af5-a84f-c00f92e3947d",
      "Url": "https://cdn.mews.li/Media/Image/e910d008-fded-4af5-a84f-c00f92e3947d?Mode=Fit&Width=600&Height=400"
    }
  ]
}
```

### RoomEnrichmentService

El método `enrichRooms()` ha sido extendido para:

1. **Obtener asignaciones de imágenes**
   ```typescript
   const imageAssignmentsData = await pmsService.resourceCategoryImageAssignmentsGetAll();
   // Mapear ImageIds por CategoryId
   imageAssignments[categoryId] = [{ id: imageId, ordering: order }, ...]
   ```

2. **Mapear recursos a categorías**
   ```typescript
   const assignmentsData = await pmsService.resourceCategoryAssignmentsGetAll();
   // Crear: resourceToCategories[resourceId] = [categoryId1, categoryId2, ...]
   ```

3. **Obtener URLs de imágenes**
   ```typescript
   const imagesData = await pmsService.imagesGetUrls(allImageIds, 600, 400, 'Fit');
   // Mapear: imageUrls[imageId] = cdnUrl
   ```

4. **Asignar imágenes a habitaciones**
   ```typescript
   for (const categoryId of categoryIds) {
     categoryImages.forEach(img => {
       const url = imageUrls[img.id];
       if (url) images.push(url);
     });
   }
   ```

## Response Format

Las habitaciones enriquecidas incluyen imágenes en el array `images`:

```typescript
interface EnrichedRoom {
  id: number;
  pmsResourceId: string;
  name: string;
  capacity: number;
  type: string;
  price: number;
  images?: string[]; // URLs de CDN ordenadas por Ordering
  // ... otros campos
}
```

## Example Response

```json
{
  "id": 1,
  "pmsResourceId": "e5a34a69-d35e-4e85-a645-a9bc4ee3a80f",
  "propertyId": 1,
  "name": "Deluxe Double Room",
  "capacity": 2,
  "type": "Deluxe",
  "basePrice": 150,
  "price": 150,
  "isMarketplaceEnabled": true,
  "images": [
    "https://cdn.mews.li/Media/Image/e910d008-fded-4af5-a84f-c00f92e3947d?Mode=Fit&Width=600&Height=400",
    "https://cdn.mews.li/Media/Image/11056cdb-2045-49e0-821f-2b93905ff522?Mode=Fit&Width=600&Height=400"
  ]
}
```

## Error Handling

Si falla la obtención de imágenes:
- Se registra una advertencia
- El enriquecimiento continúa sin imágenes
- Se retornan las imágenes locales (si las hay) del campo `images` de la BD

```typescript
try {
  // ... obtener imágenes
} catch (imageError: any) {
  console.warn('Warning: Could not fetch images from PMS:', imageError.message);
  // Continuar sin imágenes del PMS
}
```

## Usage

### En Frontend

Las imágenes se obtienen automáticamente al cargar la lista de habitaciones:

```typescript
// PropertyDetails.tsx
const { data: roomsData } = useQuery({
  queryKey: ['property-rooms', id, guests, checkIn, checkOut],
  queryFn: async () => {
    const { data } = await apiClient.get(`/public/properties/${id}/rooms`, { params });
    return data;
  }
});

// roomsData contiene:
// {
//   data: [
//     { id: 1, name: "Deluxe", images: ["url1", "url2"], ... },
//     ...
//   ]
// }
```

### En Staff Marketplace Settings

Staff puede ver imágenes del PMS al editar la propiedad:

```typescript
// MarketplaceSettings.tsx
const enrichedRooms = await RoomEnrichmentService.enrichRooms(roomsLocal);
// enrichedRooms[0].images contiene URLs del PMS
```

## Performance Considerations

1. **Batch API Calls**: Se hace una sola llamada a `getAvailability()` para todas las habitaciones
2. **Image Batch Processing**: Se obtienen URLs para todas las imágenes en una sola llamada a `imagesGetUrls()`
3. **Caching**: Los ImageIds y URLs se cachean durante el enriquecimiento de un lote

## Limitations

1. **Mews Demo Limitations**: El demo de Mews puede tener imágenes limitadas o ficticias
2. **CDN Availability**: Las URLs apuntan al CDN de Mews, disponibilidad según configuración de Mews
3. **Image Ordering**: Se respeta el `Ordering` de `ResourceCategoryImageAssignments`

## Testing

Para probar en desarrollo:

```bash
# 1. Verificar que el PMS está configurado
curl http://localhost:3000/api/pms/test-connection

# 2. Obtener habitaciones del marketplace con imágenes
curl "http://localhost:3000/api/public/properties/1/rooms?checkIn=2025-12-21&checkOut=2025-12-23"

# Respuesta contendrá array `images` con URLs de CDN
```

## References

- Mews Connector API: https://mews-systems.gitbook.io/connector-api/operations/images
- Resource Categories: https://mews-systems.gitbook.io/connector-api/operations/resourcecategories
- Resources: https://mews-systems.gitbook.io/connector-api/operations/resources
