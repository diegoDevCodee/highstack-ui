# highstack-ui — Guía para agentes de IA

> Referencia completa de `@highstacklabs2026/ui`, una librería de componentes para **Angular 22** (standalone + signals + Tailwind v4). Está escrita para que un agente de IA (Claude u otro) pueda implementar componentes correctamente y a la primera, o diagnosticar errores. Copia los ejemplos tal cual.

---

## 0. Reglas de oro (léelas antes de generar código)

1. **Todos los componentes son standalone.** Se importan en el array `imports: [...]` del componente que los usa (no hay NgModule).
2. **Angular 22 + signals.** Inputs son signals (`input()`), valores con `model()` para two-way.
3. **Selectores con prefijo `ui-`** (componentes) o `ui*`/`[ui...]` (directivas).
4. **Theming por CSS variables.** Nunca hardcodees colores; todo sale de tokens `--color-*`. Para personalizar, redefine los tokens, no toques los componentes.
5. **No inventes inputs.** Usa solo los listados aquí. Si algo no está, no existe.
6. Requiere `@angular/forms` (CVA/Reactive) y, para Signal Forms, `@angular/forms/signals` (experimental en Angular 22).

---

## 1. Instalación

```bash
npm install @highstacklabs2026/ui
```

**Estilos** (una sola vez, en tu `styles.css` global):

```css
@import '@highstacklabs2026/ui/styles.css';
```

**Uso de un componente** (todos standalone):

```ts
import { Component } from '@angular/core';
import { ButtonComponent, BadgeComponent } from '@highstacklabs2026/ui';

@Component({
  selector: 'app-demo',
  imports: [ButtonComponent, BadgeComponent],
  template: `
    <ui-button variant="gradient">Guardar</ui-button>
    <ui-badge color="success">Activo</ui-badge>
  `,
})
export class Demo {}
```

---

## 2. Temas y modo oscuro

6 paletas (`default`/zinc, `indigo`, `teal`, `violet`, `rose`, `orange`) + modo oscuro. Se activan con **clases en el `<body>`** o con el provider.

```ts
// app.config.ts
import { provideHighstack } from '@highstacklabs2026/ui';

export const appConfig = {
  providers: [
    provideHighstack({ theme: 'indigo', dark: true }),
  ],
};
```

O manual:

```html
<body class="theme-indigo dark">  <!-- tema indigo + oscuro -->
```

- Clases de tema: `theme-indigo | theme-teal | theme-violet | theme-rose | theme-orange` (sin clase = default/zinc).
- Modo oscuro: clase `dark`. Combinable con cualquier tema.
- Tokens principales (redefinibles): `--color-background`, `--color-foreground`, `--color-primary`, `--color-primary-foreground`, `--color-secondary`, `--color-accent`, `--color-muted`, `--color-muted-foreground`, `--color-border`, `--color-input`, `--color-ring`, `--color-destructive`, `--radius`.

---

## 3. Cómo funcionan los FORMULARIOS (importante)

Los componentes de formulario (**Input, Textarea, Checkbox, Switch, Radio, Select, Segmented, Datepicker, Timepicker, Timezone Select**) soportan **3 formas** de enlace, todas sobre la misma fuente de verdad:

```html
<!-- a) Two-way simple -->
<ui-input [(value)]="texto" />
<ui-checkbox [(checked)]="acepto" />

<!-- b) Reactive Forms / ngModel (ControlValueAccessor) -->
<ui-input [formControl]="ctrl" />
<ui-input formControlName="email" />

<!-- c) Signal Forms (Angular 22) -->
<ui-input [formField]="form.email" />
```

- Input/Textarea/Select/Segmented usan `value` (string). Checkbox/Switch usan `checked` (boolean). Radio usa `value` en el **grupo**.

**Errores y textos de ayuda** — mismo contrato en Input, Textarea, Select, Checkbox, Radio (en el grupo) y Segmented:

| Input | Para qué |
|---|---|
| `error` | Mensaje manual. **Gana sobre todo lo demás** y se muestra de inmediato (no espera `touched`). |
| `errors` + `touched` | Los cablea Signal Forms solo con `[formField]`. Se muestran **solo tras interactuar**. |
| `invalid` + `touched` | Marca el borde en rojo y `aria-invalid` aunque no haya texto que mostrar. |
| `hint` | Texto de ayuda. Se muestra **solo cuando no hay error**. |

- El mensaje se renderiza debajo del control. En Radio va debajo del **grupo**, no por opción.
- En Checkbox, `description` es el texto en línea junto al label; `hint` es el de abajo. Son slots distintos y pueden convivir.
- Con Reactive Forms no hay cableado automático: pasa tú `[error]` o `[invalid]`/`[touched]`.

---

## 4. Catálogo de componentes

> Formato: **import** · **selector** · inputs/outputs · ejemplo.

### Button
`ButtonComponent` · `<ui-button>`
- `variant`: `'default' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | 'gradient' | 'glass' | 'success' | 'warning'` (def. `'default'`)
- `size`: `'xs' | 'sm' | 'md' | 'lg' | 'icon'` (def. `'md'`)
- `disabled`, `loading`, `pill`, `full`: boolean · `type`: `'button'|'submit'|'reset'`
- Contenido proyectado (texto, íconos SVG).

```html
<ui-button variant="gradient" size="lg">Empezar</ui-button>
<ui-button variant="outline" [loading]="cargando">Guardar</ui-button>
<ui-button size="icon" variant="ghost"><svg>…</svg></ui-button>
```

### Input
`InputComponent` · `<ui-input>`
- `value` (model, string), `type` (`'text'|'email'|'password'|'number'|'search'|'tel'|'url'`), `size` (`'sm'|'md'|'lg'`)
- `label`, `hint`, `error`, `placeholder`, `name`, `id`: string
- `disabled`, `readonly`, `required`, `passwordToggle` (def. true): boolean
- `invalid`, `touched`, `errors`: estado de validación
- Slots: `[slot=prefix]`, `[slot=suffix]` (íconos).

```html
<ui-input label="Email" type="email" placeholder="tu@correo.com" [(value)]="email" hint="No lo compartiremos." />
<ui-input placeholder="Buscar…"><svg slot="prefix">…</svg></ui-input>
<ui-input label="Contraseña" type="password" />  <!-- trae ojito; [passwordToggle]="false" para quitarlo -->
```

### Label
`LabelComponent` · `<ui-label>`
- `for` (string): id del control asociado. `required` (boolean): muestra el asterisco `*`.
- El texto va como contenido proyectado.
- Los `<ui-input>`, `<ui-textarea>` y `<ui-select>` ya renderizan su propio label vía su prop `label`. Usa `<ui-label>` directo solo para etiquetar controles propios o casos fuera de esos componentes.

```html
<ui-label for="campo" required>Nombre</ui-label>
<mi-control id="campo"></mi-control>
```

### Textarea
`TextareaComponent` · `<ui-textarea>`
- `value` (model), `label`, `hint`, `error`, `placeholder`, `rows` (def. 4), `disabled`, `readonly`, `required`, `autoGrow` (crece con el contenido).

```html
<ui-textarea label="Biografía" [rows]="5" [autoGrow]="true" [(value)]="bio" />
```

### Phone Input
`PhoneInputComponent` · `<ui-phone-input>`
- Campo de teléfono: compone `ui-input` con un botón de bandera + prefijo en el slot `prefix` y un panel buscable con los ~240 países.
- **El valor es un string en E.164: `'+593987654321'`, o `''` si está vacío. NUNCA un objeto, ni el país y el número en campos separados.** El país se deriva del prefijo al leer.
- El país inicial sale de la región del `locale` (`'es-EC'` → 🇪🇨; `'es'` sin región → sin país), y `defaultCountry` gana si se pasa. Los nombres de país salen de `Intl`: no hay nada hardcodeado.
- `value` (model), `label`, `hint`, `error`, `placeholder`, `name`, `id`, `size` (`'sm'|'md'|'lg'`), `disabled`, `readonly`, `required`, `invalid`, `touched`, `errors`, `locale` (def. `'es-MX'`), `defaultCountry` (ISO2), `countries` (`readonly string[]`, lista blanca), `preferredCountries` (`readonly string[]`, fijados arriba), `searchPlaceholder` (def. `'Buscar país'`). Output: `countryChange` (ISO2).
- Forms: `[(value)]`, `[formField]`, `formControlName`, `ngModel`.
- Se puede **teclear el número nacional o pegar uno internacional** (`+34600111222`, `0034600111222`): al pegar, el país se re-detecta. Cambiar de país conserva los dígitos ya tecleados.
- **La validación es de longitud y dígitos, no de reglas de operadora**: `+593000000000` pasa. Para más rigor, valida en el servidor. El agrupado visual (`98 765 4321`) y los errores de longitud aparecen al salir del campo, nunca mientras se escribe.
- **El campo muestra el error de longitud, pero no bloquea nada: cerrar el botón de envío es del formulario.** Para eso está `checkE164(value)`, que resuelve el país desde el prefijo y devuelve `PhoneProblem` (`'ok' | 'empty' | 'no-country' | 'too-short' | 'too-long'`) para los ~240 países. No te copies la tabla de longitudes.

```ts
import { checkE164 } from '@highstacklabs2026/ui';

readonly telefono = signal('');
protected readonly puedeEnviar = computed(() => checkE164(this.telefono()) === 'ok');
```

```html
<ui-phone-input label="Teléfono" locale="es-EC" [(value)]="telefono" hint="Elige el país o pega el número." />
<ui-phone-input label="Teléfono" defaultCountry="MX" [preferredCountries]="['MX','US','EC']" [(value)]="telefono" />
<ui-phone-input label="Teléfono" [countries]="['EC','CO','PE']" (countryChange)="pais.set($event)" [(value)]="telefono" />
<ui-phone-input label="Teléfono" [formField]="form.telefono" />
```

### Checkbox
`CheckboxComponent` · `<ui-checkbox>`
- `checked` (model, boolean), `label`, `description`, `hint`, `error`, `size` (`'sm'|'md'`), `disabled`, `required`, `indeterminate`.
- `description` va en línea junto al label; `hint` va debajo de todo el control (como en input/select).

```html
<ui-checkbox label="Acepto los términos" [(checked)]="acepto" />
<ui-checkbox label="Todo" [indeterminate]="parcial" />
<ui-checkbox label="Acepto" error="Debes aceptar para continuar" />
```

### Switch
`SwitchComponent` · `<ui-switch>`
- `checked` (model), `label`, `description`, `size` (`'sm'|'md'`), `disabled`, `required`.

```html
<ui-switch label="Notificaciones" [(checked)]="notif" />
```

### Radio
`RadioGroupComponent` + `RadioComponent` · `<ui-radio-group>` + `<ui-radio>`
- Grupo: `value` (model), `size` (`'sm'|'md'`), `orientation` (`'vertical'|'horizontal'`), `appearance` (`'default'|'card'`), `name`, `id`, `hint`, `error`, `disabled`, `required`.
- El mensaje de error/hint se renderiza debajo del grupo (no por opción).
- Item: `value` (**requerido**), `label`, `description`, `disabled`.

```html
<ui-radio-group [(value)]="plan" appearance="card" orientation="horizontal">
  <ui-radio value="free" label="Free" description="$0/mes" />
  <ui-radio value="pro" label="Pro" description="$29/mes" />
</ui-radio-group>
```

### Segmented
`SegmentedComponent` · `<ui-segmented>`
- Selección única con apariencia de botones conectados (segmented control). Data-driven.
- `value` (model), `options` (`SegmentedOption[]`), `size` (`'sm'|'md'`), `fullWidth`, `disabled`, `name`, `id`, `hint`, `error`, `required`, `invalid`, `touched`, `errors`.
- `SegmentedOption`: `{ value, label, icon?, disabled? }` (`icon` es SVG inline opcional).
- Forms: `[(value)]`, `[formField]`, `formControlName`, `ngModel`.

```html
<!-- modelos = [{ value: 'gpt', label: 'GPT-4' }, { value: 'claude', label: 'Claude' }] -->
<ui-segmented [options]="modelos" [(value)]="modelo" />
<ui-segmented [options]="modelos" [formField]="form.modelo" [fullWidth]="true" />
```

### Select
`SelectComponent` + `OptionComponent` · `<ui-select>` + `<ui-option>`
- Select: `value` (model), `placeholder`, `label`, `hint`, `error`, `size` (`'sm'|'md'|'lg'`), `disabled`, `required`.
- Option: `value` (**requerido**), `disabled`.

```html
<ui-select label="País" placeholder="Elige…" [(value)]="pais">
  <ui-option value="mx">México</ui-option>
  <ui-option value="co">Colombia</ui-option>
  <ui-option value="ar" disabled>Argentina</ui-option>
</ui-select>
```

### Calendar
`CalendarComponent` · `<ui-calendar>`
- Cuadrícula de un mes para elegir **una** fecha. Se puede embeber suelto (sin campo de texto).
- **El valor es un string ISO `'YYYY-MM-DD'`, o `''` si no hay fecha. NUNCA un `Date`.**
- `value` (model), `month` (mes inicial, ISO), `locale` (def. `'es-MX'`), `weekStartsOn` (`0` = domingo; por defecto sale del locale), `min`, `max` (ISO), `disabledDates` (`readonly string[]`), `dateDisabled` (`(iso: string) => boolean`).
- Los nombres de mes/día, el inicio de semana y el orden de los campos salen de `Intl`: no hay texto hardcodeado.
- Teclado: ←/→ un día, ↑/↓ una semana, Inicio/Fin extremos de la semana, AvPág/RePág un mes (con Shift, un año), Enter selecciona.

```html
<ui-calendar [(value)]="fecha" min="2026-08-01" max="2026-12-31" />
<ui-calendar [(value)]="fecha" locale="en-US" [dateDisabled]="soloEntreSemana" />
```

### Datepicker
`DatepickerComponent` · `<ui-datepicker>`
- Campo de fecha: compone `ui-input` (campo, label y mensaje) con `ui-calendar` (panel flotante).
- **El valor es un string ISO `'YYYY-MM-DD'`, o `''` si no hay fecha. NUNCA un `Date`.**
- **Por defecto NO se teclea: se elige.** Toda la caja es el trigger — un clic en cualquier parte abre el calendario, igual que un `ui-select`. Así no entra basura en el campo.
- Con **`typeable`** se recupera el campo de texto y su parseo. El orden al teclear lo define el locale (`dd/mm/aaaa` en es-MX, `mm/dd/aaaa` en en-US). Útil para fechas lejanas (una de nacimiento) donde navegar el calendario es lento.
- `value` (model), `label`, `hint`, `error`, `placeholder`, `name`, `id`, `size` (`'sm'|'md'|'lg'`), `typeable` (def. `false`), `disabled`, `readonly`, `required`, `invalid`, `touched`, `errors`, más los del calendario: `locale`, `weekStartsOn`, `min`, `max`, `disabledDates`, `dateDisabled`.
- Forms: `[(value)]`, `[formField]`, `formControlName`, `ngModel`.
- Teclado: sin `typeable`, Enter, Espacio o ↓ abren el calendario. `readonly` sigue significando campo inerte: ni se teclea ni se abre nada.
- Los errores de formato (solo posibles con `typeable`) aparecen al salir del campo, nunca mientras se escribe.

```html
<ui-datepicker label="Fecha de la cita" [(value)]="fecha" />
<ui-datepicker label="Fecha de nacimiento" [typeable]="true" [(value)]="fecha" hint="Puedes escribirla o elegirla." />
<ui-datepicker label="Cita" min="2026-08-01" max="2026-12-31" [formField]="form.cita" />
<ui-datepicker label="Entrega" [disabledDates]="feriados" [formControl]="ctrl" />
```

### Timepicker
`TimepickerComponent` · `<ui-timepicker>`
- Campo de hora: compone `ui-input` (campo, label y mensaje) con un panel de columnas (horas | minutos | [segundos] | AM·PM).
- **El valor es un string en 24h `'HH:mm'` (o `'HH:mm:ss'` con `showSeconds`), o `''` si no hay hora. NUNCA un `Date`.** El formato de 12 horas con AM/PM es solo presentación: lo que ve el formulario no cambia.
- **Por defecto NO se teclea: se elige.** Toda la caja es el trigger — un clic en cualquier parte abre el panel, igual que un `ui-select`.
- Con **`typeable`** se recupera el campo de texto y su parseo: acepta `9`, `930`, `9:30`, `9:30 pm`, `9 PM`, `21:30`, `9:30:15`.
- `value` (model), `label`, `hint`, `error`, `placeholder`, `name`, `id`, `size` (`'sm'|'md'|'lg'`), `typeable` (def. `false`), `disabled`, `readonly`, `required`, `invalid`, `touched`, `errors`, `locale` (def. `'es-MX'`), `hourFormat` (`12 | 24 | 'auto'`, def. `'auto'`), `showSeconds`, `minuteStep` (def. `5`), `min`, `max` (`'HH:mm[:ss]'`), `disabledTimes` (`readonly string[]`), `timeDisabled` (`(iso: string) => boolean`).
- `hourFormat: 'auto'` deriva el formato del locale (es-MX → 12h, es-ES → 24h). El texto de AM/PM sale de `Intl`: no hay nada hardcodeado.
- Forms: `[(value)]`, `[formField]`, `formControlName`, `ngModel`.
- Teclado: sin `typeable`, Enter, Espacio o ↓ abren el panel. `readonly` sigue significando campo inerte.
- Los errores de formato (solo posibles con `typeable`) aparecen al salir del campo, nunca mientras se escribe.
- **Elegir en una columna NO cierra el panel** (a diferencia del datepicker): faltan los minutos. Se cierra con Escape, clic afuera, Tab afuera o el botón "Listo". El pie tiene también "Ahora".

```html
<ui-timepicker label="Hora de la cita" [(value)]="hora" />
<ui-timepicker label="Hora de entrada" [typeable]="true" [(value)]="hora" hint="Puedes escribirla o elegirla." />
<ui-timepicker label="Turno" [hourFormat]="24" [minuteStep]="15" [(value)]="hora" />
<ui-timepicker label="Cita" min="09:00" max="18:00" [formField]="form.cita" />
<ui-timepicker label="Marca" [showSeconds]="true" [formControl]="ctrl" />
```

### Timezone Select
`TimezoneSelectComponent` · `<ui-timezone-select>`
- Selector de zona horaria: un trigger como el del `ui-select` que abre un **modal** con buscador y la lista completa de zonas, agrupada por región.
- **El valor es el identificador IANA (`'America/Bogota'`), o `''` si no hay zona. NUNCA un offset ni un `Date`.**
- La lista sale del runtime (`Intl.supportedValuesOf('timeZone')`): ~420 zonas, cero peso en el bundle y siempre al día. El desfase se calcula en vivo, con el horario de verano ya aplicado.
- **Las etiquetas se derivan del id: sin tilde y sin país** (`Bogota`, no `Bogotá, Colombia`). Se busca por ciudad, por región (en inglés o español) y por desfase (`gmt-5` o `gmt-05:00`); por país NO.
- `value` (model), `label`, `hint`, `error`, `placeholder`, `id`, `size` (`'sm'|'md'|'lg'`), `modalTitle` (def. `'Zona horaria'`), `searchPlaceholder`, `grouped` (def. `true`), `disabled`, `required`, `invalid`, `touched`, `errors`.
- Forms: `[(value)]`, `[formField]`, `formControlName`, `ngModel`.
- Teclado: el foco se queda en el buscador y la opción activa se señala con `aria-activedescendant`. ↑/↓, PageUp/PageDown, Home/End mueven; Enter elige; Escape cierra.
- Utilidades exportadas: `getLocalTimezone()`, `toTimezoneOption(id)`, `listTimezones()`, `filterTimezones()`, `groupByRegion()`, `getTimezoneOffsetMinutes(id, date)`, `formatOffset(min)`.

```html
<ui-timezone-select label="Zona horaria" [(value)]="zona" />
<ui-timezone-select label="Zona horaria" [grouped]="false" [formField]="form.zona" />
<ui-timezone-select label="¿Dónde estás?" modalTitle="Elige tu zona" [formControl]="ctrl" />
```

```ts
// Arrancar en la zona del propio dispositivo:
import { getLocalTimezone } from '@highstacklabs2026/ui';
zona = signal(getLocalTimezone());
```

### Badge
`BadgeComponent` · `<ui-badge>`
- `variant`: `'solid' | 'soft' | 'outline' | 'glass'` (def. `'soft'`)
- `color`: `'primary' | 'secondary' | 'success' | 'warning' | 'destructive'` (def. `'primary'`)
- `size`: `'sm' | 'md'` · `dot`, `removable`: boolean · output `(remove)` · slot `[slot=icon]`.

```html
<ui-badge color="success" variant="soft" [dot]="true">Activo</ui-badge>
<ui-badge [removable]="true" (remove)="quitar()">Angular</ui-badge>
```

### Avatar
`AvatarComponent` (+ `AvatarGroupComponent`) · `<ui-avatar>` (+ `<ui-avatar-group>`)
- Avatar: `src`, `name` (genera iniciales), `alt`, `size` (`'xs'|'sm'|'md'|'lg'|'xl'`), `shape` (`'circle'|'square'`), `status` (`'online'|'offline'|'away'|'busy'|null`).
- Group: `max` (number), `size`.

```html
<ui-avatar [src]="foto" name="Juan Díaz" status="online" size="lg" />
<ui-avatar name="Ana López" />  <!-- fallback a iniciales "AL" -->
<ui-avatar-group [max]="3">
  <ui-avatar name="A B" /> <ui-avatar name="C D" /> …
</ui-avatar-group>
```

### Card
`CardComponent` + subcomponentes · `<ui-card>` + `<ui-card-header>`, `<ui-card-title>`, `<ui-card-description>`, `<ui-card-content>`, `<ui-card-footer>`
- Card: `variant` (`'elevated'|'outline'|'soft'|'interactive'`, def. `'elevated'`).

```html
<ui-card>
  <ui-card-header>
    <ui-card-title>Plan Pro</ui-card-title>
    <ui-card-description>Para equipos.</ui-card-description>
  </ui-card-header>
  <ui-card-content>$29/mes</ui-card-content>
  <ui-card-footer><ui-button [full]="true">Empezar</ui-button></ui-card-footer>
</ui-card>
```

### Modal
`ModalComponent` + subcomponentes · `<ui-modal>` + `<ui-modal-header>`, `<ui-modal-title>`, `<ui-modal-description>`, `<ui-modal-content>`, `<ui-modal-footer>`
- Modal: `[(open)]` (model boolean, controla abrir/cerrar), `size` (`'sm'|'md'|'lg'|'xl'|'full'`, def. `'md'`), `closeOnBackdrop` (def. `true`), `closeOnEscape` (def. `true`), `showClose` (def. `true`), `ariaLabel`.
- Outputs: `(opened)`, `(closed)`.
- Los subcomponentes son opcionales: puedes proyectar contenido libre dentro de `<ui-modal>`.

```html
<ui-button (click)="open.set(true)">Abrir</ui-button>

<ui-modal [(open)]="open" size="md">
  <ui-modal-header>
    <ui-modal-title>¿Eliminar proyecto?</ui-modal-title>
    <ui-modal-description>Esta acción no se puede deshacer.</ui-modal-description>
  </ui-modal-header>
  <ui-modal-content>Se borrarán todos los archivos de forma permanente.</ui-modal-content>
  <ui-modal-footer>
    <ui-button variant="ghost" (click)="open.set(false)">Cancelar</ui-button>
    <ui-button variant="destructive" (click)="open.set(false)">Eliminar</ui-button>
  </ui-modal-footer>
</ui-modal>
```

```ts
open = signal(false); // en el componente
```

### Drawer (sheet lateral)
`DrawerComponent` + subcomponentes · `<ui-drawer>` + `<ui-drawer-header>`, `<ui-drawer-title>`, `<ui-drawer-description>`, `<ui-drawer-content>`, `<ui-drawer-footer>`
- Drawer: `[(open)]` (model boolean), `side` (`'right'|'left'|'top'|'bottom'`, def. `'right'`), `size` (`'sm'|'md'|'lg'|'xl'|'full'`, def. `'md'`), `closeOnBackdrop`/`closeOnEscape`/`showClose` (def. `true`), `ariaLabel`.
- Outputs: `(opened)`, `(closed)`. Subcomponentes opcionales (mismo patrón que el modal).
- Mismo control que el modal pero entra deslizando desde un borde. Ideal para nav móvil, filtros y formularios laterales.

```html
<ui-button (click)="open.set(true)">Abrir panel</ui-button>

<ui-drawer [(open)]="open" side="right">
  <ui-drawer-header>
    <ui-drawer-title>Filtros</ui-drawer-title>
    <ui-drawer-description>Ajusta los resultados.</ui-drawer-description>
  </ui-drawer-header>
  <ui-drawer-content>…</ui-drawer-content>
  <ui-drawer-footer>
    <ui-button variant="ghost" (click)="open.set(false)">Cancelar</ui-button>
    <ui-button (click)="open.set(false)">Aplicar</ui-button>
  </ui-drawer-footer>
</ui-drawer>
```

### Dialog (modales imperativos vía servicio)
`DialogService` (`providedIn: 'root'`) + `DialogRef` + token `DIALOG_DATA`. Es la versión imperativa del modal: lo abres desde TypeScript, sin declarar `<ui-modal>` en el HTML. Se auto-monta (cero setup), reutiliza `<ui-modal>` por dentro y toda la API es basada en `Promise`.
- `confirm(opts): Promise<boolean>` — `opts`: `message` (requerido), `title?`, `confirmText?` (def. `'Confirmar'`), `cancelText?` (def. `'Cancelar'`), `confirmVariant?` (`ButtonVariant`, usa `'destructive'` para borrar).
- `alert(opts): Promise<void>` — `opts`: `message` (requerido), `title?`, `confirmText?` (def. `'Aceptar'`).
- `open<R>(Componente, opts?): DialogRef<R>` — monta un componente dinámico. `opts`: `data?` (se inyecta con `DIALOG_DATA`), `title?`/`description?` (renderizan un **header automático** arriba del componente, con su hueco para la X — no escribas el título dentro), más `size`/`closeOnBackdrop`/`closeOnEscape`/`showClose`/`ariaLabel` (mismos defaults que `<ui-modal>`). `ref.closed` es una `Promise` con el resultado; el componente se cierra con `ref.close(resultado)`.
- Cerrar por backdrop/Escape/✕ resuelve `confirm` como `false` y `open()` como `undefined`.

```ts
private dialog = inject(DialogService);

const ok = await this.dialog.confirm({
  title: '¿Eliminar proyecto?',
  message: 'Esta acción no se puede deshacer.',
  confirmText: 'Eliminar',
  confirmVariant: 'destructive',
});
if (ok) this.borrar();

await this.dialog.alert({ title: 'Listo', message: 'Cambios guardados.' });

const ref = this.dialog.open(EditarUsuarioComponent, {
  data: { id: 42 },
  title: 'Editar usuario',
  description: 'Modifica los datos y guarda.',
  size: 'lg',
});
const result = await ref.closed;
```

```ts
// El componente dinámico lee datos y se cierra por inyección. Escribe SOLO el
// cuerpo PLANO (sin sub-componentes de modal); el diálogo le da el padding y el
// header lo pone `title`/`description` de open().
export class EditarUsuarioComponent {
  private ref = inject(DialogRef<Usuario>);
  protected data = inject(DIALOG_DATA);
  guardar(u: Usuario) { this.ref.close(u); }
}
```

### Popover
`PopoverComponent` + `PopoverTriggerDirective` · `<ui-popover>` + `[uiPopoverTrigger]`
- `<ui-popover>`: `side` (`'bottom'|'top'|'left'|'right'`, def. `'bottom'`), `align` (`'start'|'center'|'end'`, def. `'center'`).
- `[uiPopoverTrigger]`: directiva en el elemento que abre el popover (con clic).
- Contenedor flotante de **contenido libre** (a diferencia del dropdown, que es un menú de ítems, y el tooltip, que es solo texto en hover). Cierra con clic-afuera o Escape.
- `side`/`align` son la posición **preferida**: si el panel no cabe en el viewport, se **voltea automáticamente** (auto-flip) al lado/alineación opuesta. No necesitas calcular bordes a mano.

```html
<ui-popover side="bottom" align="start">
  <ui-button uiPopoverTrigger variant="outline">Dimensiones</ui-button>

  <div class="space-y-2">
    <ui-input label="Ancho" />
    <ui-input label="Alto" />
  </div>
</ui-popover>
```

### Separator
`SeparatorComponent` · `<ui-separator>`
- `orientation`: `'horizontal' | 'vertical'` (def. `'horizontal'`) · `decorative`: boolean (def. `true`; ponlo `false` si separa grupos con significado semántico).

```html
<ui-separator />

<div class="flex items-center gap-3 h-5">
  <span>Inicio</span>
  <ui-separator orientation="vertical" />
  <span>Perfil</span>
</div>
```

### Alert
`AlertComponent` · `<ui-alert>`
- `type`: `'info' | 'success' | 'warning' | 'error'` (def. `'info'`)
- `variant`: `'soft' | 'solid'` · `title`: string · `closable`: boolean · output `(close)` · cuerpo proyectado.

```html
<ui-alert type="success" title="Guardado" [closable]="true" (close)="ocultar()">
  Tus cambios se aplicaron.
</ui-alert>
```

### Tooltip (directiva)
`TooltipDirective` · `[uiTooltip]`
- `uiTooltip` (texto), `tooltipPlacement` (`'top'|'bottom'|'left'|'right'`, def. `'top'`), `tooltipDelay` (ms, def. 300), `tooltipDisabled`.

```html
<ui-button uiTooltip="Guardar cambios">Guardar</ui-button>
<span uiTooltip="Info" tooltipPlacement="right">ⓘ</span>
```

### Dropdown
`DropdownComponent` + `DropdownTriggerDirective` + `DropdownItemComponent` + `DropdownLabelComponent` + `DropdownSeparatorComponent`
- `<ui-dropdown>`: `side` (`'bottom'|'top'`), `align` (`'start'|'end'`). Son la posición **preferida**: si el menú no cabe en el viewport se **voltea automáticamente** (auto-flip).
- `[uiDropdownTrigger]`: directiva en el botón disparador.
- `<ui-dropdown-item>`: output `(select)`, `destructive`, `disabled`, slots `[slot=icon]`/`[slot=shortcut]`.
- `<ui-dropdown-label>`, `<ui-dropdown-separator>`.

```html
<ui-dropdown align="end">
  <ui-button uiDropdownTrigger variant="outline">Opciones</ui-button>
  <ui-dropdown-label>Cuenta</ui-dropdown-label>
  <ui-dropdown-item (select)="editar()">Editar <span slot="shortcut">⌘E</span></ui-dropdown-item>
  <ui-dropdown-separator />
  <ui-dropdown-item destructive (select)="borrar()">Eliminar</ui-dropdown-item>
</ui-dropdown>
```

### Toast (servicio, sin setup)
`ToastService` (inyectable, `providedIn: 'root'`). El contenedor se auto-monta.
- `success/error/warning/info(message, opts?)` · `show(opts)` · `dismiss(id)` · `setPosition(pos)`.
- `opts`: `{ type?, title?, message, duration? (ms, 0 = no auto-cierra), action?: { label, handler } }`.
- Posiciones: `'top-left'|'top-center'|'top-right'|'bottom-left'|'bottom-center'|'bottom-right'` (def. `'bottom-right'`). `setPosition()` se llama normalmente una vez al inicio; si lo cambias en caliente, descarta los toasts visibles (no los reubica).

```ts
import { ToastService } from '@highstacklabs2026/ui';
private toast = inject(ToastService);

this.toast.success('Guardado');
this.toast.error('Falló', { title: 'Error', duration: 8000 });
this.toast.show({ type: 'info', message: 'Eliminado', action: { label: 'Deshacer', handler: () => undo() } });
```

### Tabs
`TabsComponent` + `TabComponent` · `<ui-tabs>` + `<ui-tab>`
- Tabs: `value` (model), `variant` (`'underline'|'pills'`), `size` (`'sm'|'md'`).
- Tab: `value` (**requerido**), `label`, `disabled`, slot `[slot=icon]`. Su contenido proyectado es el panel.

```html
<ui-tabs [(value)]="activa" variant="pills">
  <ui-tab value="cuenta" label="Cuenta">Contenido de cuenta…</ui-tab>
  <ui-tab value="seguridad" label="Seguridad">Contenido…</ui-tab>
</ui-tabs>
```

### Accordion
`AccordionComponent` + `AccordionItemComponent` · `<ui-accordion>` + `<ui-accordion-item>`
- Accordion: `multiple` (boolean; false = uno abierto a la vez).
- Item: `title` (string), `disabled`. Contenido proyectado.

```html
<ui-accordion [multiple]="false">
  <ui-accordion-item title="¿Qué incluye?">Contenido…</ui-accordion-item>
  <ui-accordion-item title="¿Precio?">Contenido…</ui-accordion-item>
</ui-accordion>
```

### Breadcrumb
`BreadcrumbComponent` + `BreadcrumbItemComponent` · `<ui-breadcrumb>` + `<ui-breadcrumb-item>`
- Item: `link` (string/array para `routerLink`; sin `link` = ítem actual). Separador chevron automático.

```html
<ui-breadcrumb>
  <ui-breadcrumb-item link="/">Inicio</ui-breadcrumb-item>
  <ui-breadcrumb-item link="/productos">Productos</ui-breadcrumb-item>
  <ui-breadcrumb-item>Camiseta</ui-breadcrumb-item>
</ui-breadcrumb>
```

### Loading: Spinner / Skeleton / Progress
`SpinnerComponent`, `SkeletonComponent`, `ProgressComponent` · `<ui-spinner>`, `<ui-skeleton>`, `<ui-progress>`
- Spinner: `size` (`'sm'|'md'|'lg'`). Hereda color (`currentColor`).
- Skeleton: `width`, `height` (CSS), `circle` (boolean).
- Progress: `value` (0-100), `size` (`'sm'|'md'|'lg'`), `indeterminate`.

```html
<ui-spinner size="md" />
<ui-skeleton width="60%" /> <ui-skeleton width="2.5rem" height="2.5rem" [circle]="true" />
<ui-progress [value]="60" /> <ui-progress [indeterminate]="true" />
```

### Pagination
`PaginationComponent` · `<ui-pagination>`
- `page` (model, **1-based**), `totalPages` (number), `variant` (`'numbers'|'compact'`), `size` (`'sm'|'md'|'lg'`, def. `'md'` — `sm` compacta botones, fuente e íconos).
- Opcional items por página: `pageSize` (model), `pageSizeOptions` (number[]).

```html
<ui-pagination [(page)]="page" [totalPages]="20" />
<ui-pagination [(page)]="page" [totalPages]="20" variant="compact" />
<ui-pagination [(page)]="page" [totalPages]="20" size="sm" />
<ui-pagination [(page)]="page" [totalPages]="20" [(pageSize)]="size" [pageSizeOptions]="[10,25,50]" />
```

### Stepper (pasos / wizard)
`StepperComponent` (+ `StepComponent`) · `<ui-stepper>` (+ `<ui-step>`). API **híbrida**: pasos por array `[steps]` **o** por componentes `<ui-step>` hijos.
- `<ui-stepper>`: `active` (model, **0-based**), `orientation` (`'horizontal'|'vertical'`, def. `'horizontal'`), `variant` (`'circles'|'progress'`, def. `'circles'`), `showCheck` (def. `true`; pasos completados muestran ✓), `linear` (def. `false`; si `true` solo navega a pasos ya completados), `clickable` (def. `true`).
- `[steps]`: `StepItem[]` = `{ label: string; description?: string }`.
- `<ui-step>`: `label`, `description`; su contenido proyectado se muestra cuando el paso está activo (modo composicional).
- La navegación se controla con `active` (two-way) y/o tus propios botones Anterior/Siguiente.

```html
<!-- Data-driven -->
<ui-stepper [(active)]="paso" [steps]="[
  { label: 'Cuenta' }, { label: 'Perfil' }, { label: 'Confirmar' }
]" />

<!-- Composicional con contenido -->
<ui-stepper [(active)]="paso" orientation="vertical">
  <ui-step label="Cuenta" description="Email y contraseña">…contenido…</ui-step>
  <ui-step label="Perfil">…contenido…</ui-step>
</ui-stepper>
```

### Table (el más complejo — leer con atención)
`TableComponent` + `TableCellDirective` + tipo `TableColumn` · `<ui-table>` + `<ng-template tableCell="…">`

**Estrategia:** es **data-driven**. Pasas `[data]` (array) y `[columns]` (array) y pinta TODO solo, incluido **acceso anidado** por path (`'direccion.ciudad'`). Para celdas que necesitan render custom (una fecha con formato, un badge, botones de acción), declaras un `<ng-template tableCell="FIELD">` y SOLO esa columna lo usa. **No se escriben filas ni celdas a mano.**

- `<ui-table>` inputs: `data` (T[]), `columns` (`TableColumn[]`), `loading` (bool → filas skeleton), `rowKey` (string, id para track/selección), `selectable` (bool), `emptyMessage` (string), `size` (`'sm'|'md'|'lg'`, default `'md'` — controla fuente y padding: `sm` compacta, `lg` espaciosa), `headerColor` (string CSS, default `'var(--color-muted)'` plomo suave, adapta a dark mode), `contentColor` (string CSS, default `'var(--color-background)'` blanco/oscuro según tema).
- Outputs: `(sortChange)` → `{ field, direction }`, `(selectionChange)` → `T[]`.
- `TableColumn`: `{ field?: string; header: string; sortable?: boolean; align?: 'left'|'center'|'right'; width?: string }`. `field` omitido = columna solo-template (p. ej. acciones).
- `<ng-template tableCell="field">` recibe contexto: `let-value` (valor de la celda, ya resuelto), `let-row="row"` (fila completa), `let-i="index"`.

```ts
cols: TableColumn[] = [
  { field: 'nombre', header: 'Nombre', sortable: true },
  { field: 'direccion.ciudad', header: 'Ciudad', sortable: true }, // anidado
  { field: 'estado', header: 'Estado' },
  { field: 'creadoEn', header: 'Creado', align: 'right' },
  { header: 'Acciones', align: 'right' },  // sin field
];
```

```html
<ui-table [data]="users" [columns]="cols" rowKey="id" [selectable]="true"
          (selectionChange)="sel.set($event)">

  <!-- solo las columnas especiales llevan template -->
  <ng-template tableCell="estado" let-value>
    <ui-badge [color]="value === 'activo' ? 'success' : 'secondary'" variant="soft">{{ value }}</ui-badge>
  </ng-template>

  <ng-template tableCell="creadoEn" let-value>
    <mi-fecha [valor]="value" />   <!-- TU componente -->
  </ng-template>

  <ng-template tableCell="Acciones" let-row="row">
    <ui-button size="sm" (click)="editar(row)">Editar</ui-button>
  </ng-template>
</ui-table>
```

---

## 5. Gotchas / errores frecuentes (para diagnosticar rápido)

- **"X is not a known element" / no se ve el componente** → faltó importar la clase en `imports: [...]` del componente que lo usa (todos son standalone).
- **Estilos no aplican / se ve sin formato** → falta `@import '@highstacklabs2026/ui/styles.css'` en el `styles.css` global.
- **Dark mode no cambia los componentes** → activar con clase `dark` en `<body>` (o `provideHighstack({ dark: true })`). Los componentes ya usan tokens; no requieren cambios.
- **Table: la celda custom no aparece / sale el texto crudo** → el `tableCell="X"` debe coincidir EXACTAMENTE con el `field` (o `header` si no hay field) de la columna.
- **NG5002 "Invalid ICU message"** → hay una llave `{` literal en un template HTML; escápala o reescribe el texto.
- **Multi `<ng-content>`**: si proyectas contenido y "desaparece", probablemente hay 2 `<ng-content>` sin `select` en ramas `@if/@else`; usa uno solo.
- **Signal Forms** (`[formField]`) es API **experimental** de Angular 22 (`@angular/forms/signals`). Si no quieres experimental, usa `[formControl]`/`formControlName` (estable) — todos los componentes de formulario lo soportan vía ControlValueAccessor.
- **El autofill del navegador se ve con fondo azul** → falta `@import '@highstacklabs2026/ui/styles.css'`. El fix vive en esa hoja, no en las clases del componente.
- **Calendar/Datepicker: el valor es un string `'YYYY-MM-DD'`, no un `Date`.** Si le pasas un `Date` o un ISO con hora (`'2026-08-01T00:00:00Z'`) el componente lo normaliza a `''` y el campo sale vacío. Convierte antes de enlazar, y espera un string de vuelta.
- **Timepicker: el valor es un string 24h `'HH:mm'`/`'HH:mm:ss'`, no un `Date`.** `hourFormat` solo cambia lo que se ve; el valor sigue siendo de 24 horas. Si le pasas basura (`'25:00'`, un `Date`) lo normaliza a `''`.
- **Timezone Select: el valor es el id IANA (`'America/Bogota'`), no el desfase.** El `GMT-05:00` que se ve es presentación calculada al vuelo, y cambia con el horario de verano: guardar el offset en vez del id te deja con una hora mal medio año. Buscar por país no funciona (las etiquetas salen del id, sin país).
- **Phone Input: el valor es un string E.164 (`'+593987654321'`), no un objeto ni dos campos.** Si necesitas el país aparte, escucha `countryChange` (te da el ISO2); no partas el string a mano. Si le pasas basura (`'+'`, un número) lo normaliza a `''`, y un número sin `+` se toma como número **nacional** del país actual.
- **Phone Input: un número incompleto o demasiado largo llega igual a tu `value`.** El campo pinta el error al salir del foco, pero sigue publicando el E.164, así que si tu botón de envío solo comprueba "no está vacío", `+3499388394824` acaba en el back-end. Cierra el botón con `checkE164(value) === 'ok'`.
- **Phone Input: con prefijos compartidos (`+1` → US/CA/PR, `+7` → RU/KZ) el valor siempre es correcto, pero la bandera puede no serlo.** Si el usuario eligió el país, su elección se respeta; un número que llega de fuera sin elección previa se muestra con el país principal (Estados Unidos, Rusia). Distinguirlos exige la metadata de operadoras que este componente evita a propósito.
- **Un select / datepicker / timepicker / phone input / dropdown / popover dentro de un modal o un drawer se ve correctamente por encima, sin recortes.** No hay que hacer nada: sus paneles se montan en un contenedor `[data-ui-overlay-root]` a nivel de `<body>`. Si necesitas cambiar las capas, redefine los tokens `--z-modal` (1000), `--z-overlay` (1100) y `--z-toast` (1200) — no pongas `z-index` a mano en los componentes.
- **Radio/Select/Tabs/Dropdown/Accordion/Breadcrumb** son **compositional**: el contenedor (`ui-*-group`/`ui-*`) y los items deben importarse AMBOS y usarse juntos (los items se inyectan del padre por DI).

---

## 6. Lista rápida de imports (todos desde `@highstacklabs2026/ui`)

```
ButtonComponent, InputComponent, TextareaComponent, PhoneInputComponent, LabelComponent, CheckboxComponent, SwitchComponent,
RadioGroupComponent, RadioComponent, SegmentedComponent, SelectComponent, OptionComponent,
CalendarComponent, DatepickerComponent, TimepickerComponent, TimezoneSelectComponent,
BadgeComponent, AvatarComponent, AvatarGroupComponent,
CardComponent, CardHeaderComponent, CardTitleComponent, CardDescriptionComponent, CardContentComponent, CardFooterComponent,
ModalComponent, ModalHeaderComponent, ModalTitleComponent, ModalDescriptionComponent, ModalContentComponent, ModalFooterComponent,
DrawerComponent, DrawerHeaderComponent, DrawerTitleComponent, DrawerDescriptionComponent, DrawerContentComponent, DrawerFooterComponent,
PopoverComponent, PopoverTriggerDirective, SeparatorComponent,
DialogService, DialogRef, DIALOG_DATA,
StepperComponent, StepComponent,
AlertComponent, TooltipDirective,
DropdownComponent, DropdownTriggerDirective, DropdownItemComponent, DropdownLabelComponent, DropdownSeparatorComponent,
ToastService, TabsComponent, TabComponent,
AccordionComponent, AccordionItemComponent, BreadcrumbComponent, BreadcrumbItemComponent,
SpinnerComponent, SkeletonComponent, ProgressComponent,
TableComponent, TableCellDirective, TableColumn (tipo),
PaginationComponent,
checkE164 (función), PhoneProblem (tipo),
getLocalTimezone, toTimezoneOption, listTimezones, filterTimezones, groupByRegion, getTimezoneOffsetMinutes, formatOffset (funciones), TimezoneOption, TimezoneGroup (tipos),
provideHighstack
```
