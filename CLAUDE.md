# Turnitos — Especificación funcional para desarrollo

## Contexto del proyecto

Turnitos es una plataforma **multi-tenant** de reserva de turnos online, enfocada inicialmente en **peluquerías**. Un solo sistema aloja múltiples peluquerías (negocios), cada una con su propia URL/slug, servicios, estilistas y agenda, totalmente aisladas entre sí. Los clientes reservan sin necesidad de crear cuenta.

Este documento está dividido en etapas pensadas para desarrollarse en orden. Cada etapa depende de que la anterior esté funcionando. Una etapa a la vez.

---

## Stack técnico

- **Frontend:** JavaScript + React + Tailwind CSS
- **Backend / base de datos:** Supabase (Postgres)
  - **Auth** de Supabase para el login de UsuarioNegocio y SuperAdmin
  - **Row Level Security (RLS)** activado en las tablas Negocio, Estilista, Servicio y Turno como capa adicional de aislamiento multi-tenant, sumada al filtrado por `negocio_id` que ya debe hacer la aplicación
  - **Storage** de Supabase para logos de negocio y fotos de estilistas
  - **Edge Functions** para la lógica que no encaja en RLS pensado para usuarios logueados: creación de turno, cancelación y reprogramación por parte del cliente sin cuenta. Estas funciones validan el `token_gestion` y operan con la service role key del lado del servidor, en vez de forzar ese flujo dentro de una policy de RLS. También son el lugar natural para disparar las notificaciones de la Etapa 7.

---

## Modelo de datos (entidades principales)

- **Negocio** (tenant): id, nombre, slug único, logo_url, descripción breve, redes_sociales (json), dirección, teléfono (opcional), email, horario_atencion (json por día de la semana), estado (activo/inactivo)
- **UsuarioNegocio** (login del dueño/admin): id, negocio_id, email, password_hash
- **Estilista**: id, negocio_id, nombre, foto_url (opcional), especialidad (opcional), horario_disponible (json por día), activo (bool)
- **Servicio**: id, negocio_id, nombre, descripción, precio, duración_minutos, activo (bool)
- **Turno**: id, negocio_id, estilista_id (nullable = "cualquiera disponible"), servicio_id, fecha, hora_inicio, hora_fin (calculada = hora_inicio + duración del servicio), estado (confirmado / cancelado / completado), cliente_nombre, cliente_email, cliente_telefono, nota, monto, token_gestion (string único, para que el cliente cancele/reprograme sin login), created_at
- **SuperAdmin**: id, email, password_hash

**Regla transversal importante:** todas las consultas de disponibilidad de horarios deben cruzar horario_atencion del negocio + horario_disponible del estilista elegido + duración del servicio + turnos ya ocupados de ese estilista en esa fecha, para no ofrecer horarios que en la práctica se superponen.

---

## Roles del sistema

1. **Super-admin**: dueño de la plataforma Turnitos. Gestiona los negocios registrados.
2. **Admin de negocio**: dueño/encargado de la peluquería. Gestiona servicios, estilistas, horarios y turnos de su negocio.
3. **Cliente**: sin cuenta. Se identifica con email/teléfono al reservar, y gestiona su turno vía un link/token único enviado por email.

---

## Etapa 0 — Arquitectura base y modelo de datos

**Objetivo:** dejar la base técnica lista antes de tocar ninguna pantalla.

- Proyecto Supabase configurado (React + Tailwind del lado del frontend)
- Implementar el modelo de datos descripto arriba como tablas Postgres en Supabase (migraciones/esquema)
- Activar RLS en Negocio, Estilista, Servicio y Turno, con policies que restrinjan cada fila a su `negocio_id`, además del filtrado que haga la aplicación
- Sistema de slugs únicos por negocio (validar formato, evitar duplicados)
- Autenticación con Supabase Auth para UsuarioNegocio y SuperAdmin (login con email + password)
- Generación de token único no adivinable (`token_gestion`) para que el cliente sin cuenta gestione su turno
- Primera Edge Function base: crear turno validando disponibilidad y token, para no depender de RLS pensado para usuarios logueados

**Criterio de aceptación:** se puede crear un negocio, un servicio y un estilista a través de la base de datos/API, y aislar correctamente los datos entre dos negocios de prueba.

---

## Etapa 1 — Registro y onboarding del negocio

**Pantalla: Registro**
- Nombre del negocio
- Email
- Contraseña
- Elección de slug (o autogenerado a partir del nombre, editable)

**Wizard de configuración inicial** (tras registrarse, antes de llegar al panel)
1. Datos del negocio: logo, nombre, descripción breve, redes sociales, dirección, teléfono (opcional)
2. Horario de atención: días y franjas horarias en las que el negocio abre
3. Alta del primer servicio (nombre, descripción, precio, duración)
4. Alta del primer estilista (nombre, foto opcional, horario disponible)

**Validaciones**
- Slug único en toda la plataforma
- Email único por negocio
- Horario de atención no puede tener franjas inválidas (hora fin > hora inicio)

**Criterio de aceptación:** un negocio nuevo se puede registrar, completar el wizard y quedar con al menos un servicio y un estilista configurados.

---

## Etapa 2 — Panel de administración: servicios y estilistas

**Pantalla: ABM de servicios**
- Listado de servicios del negocio
- Alta/edición: nombre, descripción, precio, duración (minutos), activo/inactivo
- Baja lógica (no eliminar turnos históricos asociados)

**Pantalla: ABM de estilistas**
- Listado de estilistas del negocio
- Alta/edición: nombre, foto (opcional), especialidad (opcional), horario disponible por día, activo/inactivo
- Baja lógica

**Criterio de aceptación:** el admin del negocio puede crear, editar y desactivar servicios y estilistas desde el panel, sin afectar turnos ya reservados.

---

## Etapa 3 — Panel de administración: agenda, horarios y reportes

**Pantalla: Agenda**
- Vista día/semana con los turnos del negocio
- Filtro por estilista
- Detalle de cada turno al hacer click (mismo contenido que la pantalla de confirmación del cliente)

**Pantalla: Configuración de horarios**
- Editar horario de atención general del negocio
- Marcar días no laborables puntuales (feriados, cierres excepcionales)

**Pantalla: Reportes**
- Turnos por período (día/semana/mes)
- Ingresos estimados por servicio (suma de montos de turnos completados)
- Cantidad de cancelaciones

**Criterio de aceptación:** el admin puede ver de un vistazo la agenda del día y consultar reportes básicos de un rango de fechas.

---

## Etapa 4 — Flujo de reserva del cliente (pantalla inicial → selección)

**Pantalla: Inicial** (accedida vía slug del negocio, ej. `turnitos.com/peluqueria-ana`)
- Logotipo
- Nombre
- Breve descripción del negocio
- Redes sociales
- Dirección
- Teléfono (opcional)
- Botón "Nuevo turno"
- Botón "Ver o modificar turno"

**Pantalla: Reservar turno**
- Cards de servicios ofrecidos (nombre, descripción, monto), seleccionables
- Selección de estilista (opcional): listado de estilistas activos + opción "cualquiera disponible"
- Calendario interactivo con fechas disponibles
- Cards con horas disponibles para el día elegido (calculadas según la regla transversal de disponibilidad)

**Criterio de aceptación:** un cliente puede entrar a la página de un negocio, elegir servicio, estilista (u omitirlo) y ver únicamente horarios que realmente están libres.

---

## Etapa 5 — Datos personales y confirmación del turno

**Pantalla: Datos personales**
- Nombre completo
- Email
- Teléfono
- Nota (opcional)

**Pantalla: Confirmación del turno**
- Info completa: negocio, servicio, estilista (si aplica), fecha, hora, monto, datos personales del cliente
- Se genera el token de gestión y se envía por email al cliente

**Validaciones**
- Verificar que el horario elegido siga disponible al momento de confirmar (evitar doble reserva por condición de carrera)
- Email y teléfono con formato válido

**Criterio de aceptación:** al confirmar, se crea el turno en la base de datos, se le muestra el resumen al cliente y se dispara la notificación (ver Etapa 7).

---

## Etapa 6 — Mis turnos: ver, cancelar, reprogramar

**Pantalla: Ver o modificar turno**
- Acceso por link con token (enviado por email) o por formulario de búsqueda con email

**Pantalla: Mis turnos**
- Card por turno: email de quien reservó, servicio, fecha, hora, monto
- Botón "Cancelar turno"
- Botón "Reprogramar turno"

**Pantalla: Reprogramar turno**
- Mail de quien reservó, servicio, monto (no editables)
- Fecha (editable, con calendario)
- Hora (editable, según disponibilidad real)
- Botón "Guardar"

**Pantalla: Cancelar turno**
- Card con detalle del turno: mail, servicio, fecha, hora, monto
- Confirmación de cancelación
- Al cancelar, se notifica al negocio (ver Etapa 7)

**Criterio de aceptación:** un cliente puede encontrar su turno, cancelarlo o reprogramarlo a un horario válido, sin necesidad de cuenta.

---

## Etapa 7 — Notificaciones

- **Al cliente:** confirmación al reservar (con link de gestión), recordatorio antes del turno (ej. 24hs antes)
- **Al negocio:** aviso de turno nuevo, aviso de cancelación, aviso de reprogramación
- Canal principal sugerido: email. Dejar la arquitectura preparada para sumar WhatsApp más adelante sin rehacer la lógica de notificaciones.

**Criterio de aceptación:** cada evento (reserva, cancelación, reprogramación) dispara la notificación correspondiente a cliente y/o negocio.

---

## Etapa 8 — Rol super-admin (plataforma)

**Pantalla: Listado de negocios**
- Ver todos los negocios registrados, con estado (activo/inactivo)

**Acciones**
- Activar/desactivar un negocio
- Ver métricas generales de uso (cantidad de negocios, turnos totales en la plataforma)

**Criterio de aceptación:** el super-admin puede administrar el ciclo de vida de los negocios registrados sin acceder a los datos operativos internos de cada uno más allá de lo necesario.

---

## Etapa 9 (futuro, no incluida en el MVP) — Pagos online

- Seña o pago total al reservar
- Métodos de pago (ej. Mercado Pago)
- Reembolso en caso de cancelación

Se deja documentada para no perderla de vista, pero no forma parte del alcance inicial.