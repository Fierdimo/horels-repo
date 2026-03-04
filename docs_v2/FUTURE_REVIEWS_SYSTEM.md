# Sistema de Calificaciones y Reseñas — Plan Fase Futura

> **Estado:** Pendiente de implementación  
> **Prioridad:** Media-Alta (sugerir al cliente cuando pregunte sobre ratings/estrellas del hotel)  
> **Prerequisitos:** Sistema de reservas completado, emails transaccionales activos

---

## Contexto y motivación

Durante la implementación del módulo de Marketplace (staff hotel management) se encontró que la tabla `timeshare_properties` **no tiene columna `stars`** y el diseño correcto no debería tenerla: una calificación debe derivarse de experiencias reales de huéspedes, no ser un valor estático asignado manualmente.

Este módulo reemplaza ese concepto con un sistema real de reseñas verificadas.

---

## Arquitectura — tabla principal

```sql
CREATE TABLE reviews (
  id                  INT PRIMARY KEY AUTO_INCREMENT,
  reservation_id      INT NOT NULL,          -- solo reservas con status = 'completed'
  reviewer_user_id    INT NOT NULL,
  property_id         INT NOT NULL,
  unit_id             INT NULL,              -- opcional: califica unidad específica

  -- Scores (1–5)
  overall_score       TINYINT NOT NULL,
  cleanliness_score   TINYINT NULL,
  location_score      TINYINT NULL,
  amenities_score     TINYINT NULL,
  value_score         TINYINT NULL,
  staff_score         TINYINT NULL,

  -- Contenido
  title               VARCHAR(150) NULL,
  comment             TEXT NULL,
  photos              JSON NULL,             -- URLs subidas por el huésped
  language            VARCHAR(5) DEFAULT 'es',

  -- Moderación
  status              ENUM('pending','published','rejected') DEFAULT 'pending',
  rejection_reason    VARCHAR(255) NULL,

  -- Respuesta del hotel
  staff_response      TEXT NULL,
  staff_response_at   DATETIME NULL,
  staff_response_by   INT NULL,             -- FK users (staff)

  -- Social
  helpful_count       INT DEFAULT 0,

  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_review_per_reservation (reservation_id),  -- 1 review por reserva
  INDEX idx_property (property_id),
  INDEX idx_status (status)
);
```

### Campo cacheado en `timeshare_properties`

En lugar de un `stars` estático, agregar dos campos calculados:

```sql
ALTER TABLE timeshare_properties
  ADD COLUMN cached_rating       DECIMAL(2,1) NULL,   -- ej: 4.7
  ADD COLUMN cached_review_count INT DEFAULT 0;
```

Se recalculan automáticamente al publicar/rechazar cada reseña. Nunca se editan manualmente.

---

## Endpoints de API propuestos

### Públicos (marketplace)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/marketplace/properties/:id/reviews` | Lista reseñas publicadas de un hotel |
| `GET` | `/marketplace/properties/:id/reviews/summary` | Score promedio por dimensión |

### Autenticados (dueños/huéspedes)
| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/reviews` | Crear reseña (requiere `reservation_id` completada) |
| `GET` | `/reviews/mine` | Ver mis reseñas |
| `PUT` | `/reviews/:id` | Editar reseña (solo si `status = pending`) |
| `POST` | `/reviews/:id/helpful` | Marcar reseña como útil |

### Staff
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/hotel-staff/reviews` | Ver reseñas de su hotel |
| `PUT` | `/hotel-staff/reviews/:id/respond` | Responder públicamente a una reseña |

### Admin
| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/reviews` | Todas las reseñas (filtro por status) |
| `PUT` | `/admin/reviews/:id/status` | Publicar o rechazar reseña |

---

## Flujo de usuario

```
Reserva completada (checkout)
        ↓
Email automático D+1: "¿Cómo fue tu estadía? Dejanos tu opinión"
        ↓
Owner/huésped llena formulario (overall + dimensiones opcionales + comentario)
        ↓
Status = 'pending' → entra a cola de moderación admin
        ↓
Admin aprueba → status = 'published'
        ↓
cached_rating y cached_review_count se actualizan en el hotel
        ↓
Reseña visible en el Marketplace
        ↓
Staff puede responder públicamente desde su dashboard
```

---

## Features accesorias

| Feature | Complejidad | Valor |
|---------|-------------|-------|
| **Verified stay badge** | Baja — condición en `reservation.status` | Alta |
| **Moderación admin** | Baja — CRUD de status | Alta |
| **Respuesta del staff** | Baja — campo texto + timestamp | Alta |
| **Score por dimensión** | Baja — campos extra en la tabla | Media |
| **Fotos del huésped** | Media — reutiliza `ImageUploader` existente | Media |
| **Email trigger post-checkout** | Media — requiere job scheduler | Alta |
| **Votos "fue útil"** | Media — tabla pivot `review_helpful` | Baja |
| **Filtros en marketplace** | Media — sort by rating, filter by score | Alta |
| **Sentiment analysis** | Alta — integración LLM/API externa | Baja-Media |

---

## Integración con el código actual

- **`ImageUploader.tsx`** — reutilizable para fotos del huésped en la reseña, sin cambios
- **`MarketplaceSettings.tsx`** — agregar sección "Reseñas de mi hotel" con `staff_response`
- **`PropertyDetails.tsx`** — agregar sección de reseñas + score visual
- **`Property` model** — solo agregar `cached_rating` y `cached_review_count`
- Los `stars` que actualmente no existen en DB serían reemplazados definitivamente por este sistema

---

## Sugerencia para el cliente

> *"Actualmente el marketplace muestra la información del hotel sin calificaciones. Podemos agregar un sistema de reseñas verificadas donde los dueños que se hayan hospedado califiquen su experiencia en 5 dimensiones. Esto aumenta la conversión en el marketplace y da credibilidad a las propiedades. Las calificaciones serían moderadas antes de publicarse y el staff podría responder públicamente a cada reseña."*
