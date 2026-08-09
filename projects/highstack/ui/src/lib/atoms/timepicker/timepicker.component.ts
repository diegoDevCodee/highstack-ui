import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  model,
  numberAttribute,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputComponent } from '../input/input.component';
import { positionOverlay } from '../../shared/overlay-position';
import { containsTarget } from '../../shared/overlay-container';
import { OverlayPortalDirective } from '../../shared/overlay-portal.directive';
import {
  HourFormat,
  compareTimes,
  formatTimeForDisplay,
  from12Hour,
  hourOptions,
  isValidIsoTime,
  now,
  parseIsoTime,
  parseLocalizedTime,
  resolveHourFormat,
  stepOptions,
  to12Hour,
  toIsoTime,
} from './time-utils';

export type TimepickerSize = 'sm' | 'md' | 'lg';

// Los tipos que aparecen en la API pública del componente se re-exportan aquí,
// para que `time-utils` siga siendo interno (igual que `date-utils` en calendar).
export type { HourFormat, IsoTime } from './time-utils';

/** Qué elige cada columna del panel. */
export type TimeColumnKind = 'hour' | 'minute' | 'second' | 'period';

/** Una opción ya resuelta para el template. */
export interface TimeOption {
  /** Valor crudo: el número de la columna, o 'am'/'pm' en la de periodo. */
  value: string;
  label: string;
  selected: boolean;
  disabled: boolean;
}

/** Una columna del panel, ya resuelta para el template. */
export interface TimeColumn {
  kind: TimeColumnKind;
  label: string;
  options: TimeOption[];
}

/** Forma laxa de un error de validación (Signal Forms entrega { kind, message? }). */
interface TimepickerValidationError {
  kind?: string;
  message?: string;
}

let nextId = 0;

/**
 * Selector de hora: compone ui-input (para el campo, el label y el mensaje) con
 * un panel de columnas (horas | minutos | [segundos] | AM·PM).
 *
 * Es el gemelo del Datepicker y comparte sus dos decisiones de fondo:
 *
 *  - **El valor es un string en 24h** (`'HH:mm'`, o `'HH:mm:ss'` con
 *    `showSeconds`), nunca un `Date`. El formato de 12 horas es solo presentación.
 *  - Mantiene DOS fuentes de verdad sincronizadas: `value` (lo que ve el
 *    formulario) y `text` (lo que hay en la caja). Las reglas de esa sincronía
 *    están documentadas en cada método.
 *
 * A diferencia del calendario, **elegir en una columna no cierra el panel**:
 * elegir la hora no es la acción terminal, todavía faltan los minutos.
 */
@Component({
  selector: 'ui-timepicker',
  templateUrl: './timepicker.component.html',
  imports: [InputComponent, OverlayPortalDirective],
  host: { class: 'block' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => TimepickerComponent), multi: true },
  ],
})
export class TimepickerComponent implements ControlValueAccessor {
  /** Hora en 24h: `'HH:mm'`, o `'HH:mm:ss'` con `showSeconds`. `''` si no hay. */
  readonly value = model<string>('');

  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly placeholder = input<string>('');
  readonly name = input<string>('');
  readonly id = input<string>(`ui-timepicker-${nextId++}`);
  readonly size = input<TimepickerSize>('md');

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });

  /**
   * Permite escribir la hora a mano.
   *
   * Por defecto está apagado: el campo entero se comporta como el trigger de un
   * select — un clic en cualquier parte abre el panel y no se puede teclear.
   * Ponlo a `true` para recuperar el campo de texto con su parseo (`9`, `930`,
   * `9:30 pm`, `21:30`…).
   */
  readonly typeable = input(false, { transform: booleanAttribute });

  /** Mensaje de error manual (tiene prioridad sobre todo lo demás). */
  readonly error = input<string>('');
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly TimepickerValidationError[]>([]);

  readonly locale = input<string>('es-MX');
  /** 12, 24, o `'auto'` para derivarlo del locale. */
  readonly hourFormat = input<HourFormat>('auto');
  readonly showSeconds = input(false, { transform: booleanAttribute });
  /** Paso de la columna de minutos. Se clampea a [1, 60]. */
  readonly minuteStep = input(5, { transform: numberAttribute });

  // Signal Forms escribe min/max como `string | undefined` al cablear
  // [formField]; el transform los normaliza a '' para que dentro siempre sean
  // string y no haya que defenderse en cada comparación.
  readonly min = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly max = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly disabledTimes = input<readonly string[]>([]);
  readonly timeDisabled = input<((iso: string) => boolean) | undefined>(undefined);

  /** Lo que hay literalmente en la caja de texto. */
  protected readonly text = signal<string>('');
  /** ¿El usuario ya editó el texto? Ver `onBlur`. */
  private dirty = false;
  private focusedField = false;
  /** Error de parseo/restricción, revelado solo tras blur o Enter. */
  protected readonly parseError = signal<string>('');

  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  /** 12 o 24, ya resuelto el `'auto'`. */
  protected readonly resolvedFormat = computed(() =>
    resolveHourFormat(this.hourFormat(), this.locale()),
  );

  constructor() {
    // El valor puede cambiar desde afuera (writeValue, [(value)], formField).
    // Reformatear mientras el campo tiene foco movería el caret bajo el cursor,
    // así que solo se sincroniza cuando no está enfocado.
    effect(() => {
      const iso = this.value();
      if (this.focusedField) return;
      this.text.set(this.display(iso));
    });
  }

  private display(iso: string): string {
    return formatTimeForDisplay(iso, {
      locale: this.locale(),
      hourFormat: this.hourFormat(),
      showSeconds: this.showSeconds(),
    });
  }

  /** Precedencia: manual > parseo > Signal Forms (tras touched). */
  protected readonly resolvedError = computed(() => {
    if (this.error()) return this.error();
    if (this.parseError()) return this.parseError();
    if (this.touched()) {
      const first = this.errors()[0];
      if (first) return first.message ?? first.kind ?? 'Campo inválido';
    }
    return '';
  });

  // --- Modelo del panel ---

  /** La hora elegida, o null si el campo está vacío. */
  private readonly selected = computed(() => parseIsoTime(this.value()));

  /**
   * Sobre qué hora se aplica la siguiente elección. Con el campo vacío se parte
   * de la hora actual: elegir "9" en la columna de horas tiene que producir una
   * hora completa, no dejar el valor a medias.
   */
  private base(): { h: number; m: number; s: number } {
    return this.selected() ?? parseIsoTime(now(this.minuteStep()))!;
  }

  /** Pasa una hora a la precisión que el componente publica. */
  private canonical(h: number, m: number, s: number): string {
    return toIsoTime(h, m, s, this.showSeconds());
  }

  protected readonly columns = computed<TimeColumn[]>(() => {
    const format = this.resolvedFormat();
    const sel = this.selected();
    const base = this.base();
    const cols: TimeColumn[] = [];

    // --- Horas ---
    const period = to12Hour(base.h).period;
    cols.push({
      kind: 'hour',
      label: 'Hora',
      options: hourOptions(format).map((h) => {
        const real = format === 12 ? from12Hour(h, period) : h;
        return {
          value: String(h),
          label: format === 12 ? String(h) : String(h).padStart(2, '0'),
          selected: !!sel && sel.h === real,
          disabled: this.violates(real, base.m, base.s),
        };
      }),
    });

    // --- Minutos ---
    cols.push({
      kind: 'minute',
      label: 'Minutos',
      options: stepOptions(this.minuteStep()).map((m) => ({
        value: String(m),
        label: String(m).padStart(2, '0'),
        selected: !!sel && sel.m === m,
        disabled: this.violates(base.h, m, base.s),
      })),
    });

    // --- Segundos ---
    if (this.showSeconds()) {
      cols.push({
        kind: 'second',
        label: 'Segundos',
        options: stepOptions(1).map((s) => ({
          value: String(s),
          label: String(s).padStart(2, '0'),
          selected: !!sel && sel.s === s,
          disabled: this.violates(base.h, base.m, s),
        })),
      });
    }

    // --- AM/PM: solo tiene sentido en el reloj de 12 ---
    if (format === 12) {
      cols.push({
        kind: 'period',
        label: 'Periodo',
        options: (['am', 'pm'] as const).map((p) => {
          const real = from12Hour(to12Hour(base.h).hour12, p);
          return {
            value: p,
            label: this.periodLabel(p),
            selected: !!sel && to12Hour(sel.h).period === p,
            disabled: this.violates(real, base.m, base.s),
          };
        }),
      });
    }

    return cols;
  });

  /** El texto de am/pm sale del locale, no está escrito aquí. */
  private periodLabel(p: 'am' | 'pm'): string {
    const iso = p === 'am' ? '09:00' : '21:00';
    const parts = formatTimeForDisplay(iso, { locale: this.locale(), hourFormat: 12 }).split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : p.toUpperCase();
  }

  /** ¿Esta hora incumple min/max o está en la lista de no disponibles? */
  private violates(h: number, m: number, s: number): boolean {
    const iso = this.canonical(h, m, s);

    const min = this.min();
    if (min && compareTimes(iso, min) < 0) return true;

    const max = this.max();
    if (max && compareTimes(iso, max) > 0) return true;

    if (this.disabledTimes().some((t) => compareTimes(t, iso) === 0)) return true;
    if (this.timeDisabled()?.(iso)) return true;

    return false;
  }

  /** Elegir en una columna. Emite en vivo y NO cierra el panel. */
  protected pick(kind: TimeColumnKind, raw: string) {
    const b = this.base();
    let { h, m, s } = b;

    switch (kind) {
      case 'hour': {
        const n = Number(raw);
        h = this.resolvedFormat() === 12 ? from12Hour(n, to12Hour(b.h).period) : n;
        break;
      }
      case 'minute':
        m = Number(raw);
        break;
      case 'second':
        s = Number(raw);
        break;
      case 'period':
        h = from12Hour(to12Hour(b.h).hour12, raw as 'am' | 'pm');
        break;
    }

    this.commit(this.canonical(h, m, s));
  }

  /** Pone la hora actual en el campo. */
  protected pickNow() {
    const p = parseIsoTime(now(this.minuteStep()))!;
    this.commit(this.canonical(p.h, p.m, p.s));
  }

  private commit(iso: string) {
    this.dirty = true;
    this.value.set(iso);
    this.text.set(this.display(iso));
    this.parseError.set('');
    this.onChange(iso);
    this.onTouched();
  }

  // --- Sincronización texto -> valor ---

  protected onTextInput(next: string) {
    this.dirty = true;
    this.text.set(next);
    // Al teclear NUNCA se muestra error: '9:' es un estado de camino válido.
    this.parseError.set('');

    // `parseLocalizedTime` devuelve la forma canónica con segundos; se vuelve a
    // partir para poder aplicarle la precisión del componente y las reglas.
    const parsed = parseIsoTime(
      parseLocalizedTime(next, { locale: this.locale(), hourFormat: this.hourFormat() }) ?? '',
    );
    // Texto que no se entiende, o que se entiende pero apunta a una hora
    // prohibida, deja el valor vacío: el formulario no debe ver algo inválido.
    const usable = parsed && !this.violates(parsed.h, parsed.m, parsed.s);
    this.value.set(usable ? this.canonical(parsed.h, parsed.m, parsed.s) : '');
    this.onChange(this.value());
  }

  protected onFocus() {
    this.focusedField = true;
  }

  /**
   * Al salir del campo se revela el error, si lo hay.
   *
   * Solo se valida texto que el usuario editó: si el valor vino de afuera y
   * nadie tecleó, pasar con Tab por un formulario precargado no debe borrar nada
   * ni marcar error.
   */
  protected onBlur() {
    this.focusedField = false;
    this.onTouched();

    if (!this.dirty) {
      this.text.set(this.display(this.value()));
      return;
    }

    this.parseError.set(this.validateText(this.text()));
    if (!this.parseError() && this.value()) {
      this.text.set(this.display(this.value()));
    }
  }

  /** Devuelve el mensaje adecuado, o '' si el texto está bien. */
  private validateText(text: string): string {
    if (!text.trim()) return '';

    const parsed = parseIsoTime(
      parseLocalizedTime(text, { locale: this.locale(), hourFormat: this.hourFormat() }) ?? '',
    );
    if (!parsed) {
      // Distinguir "no existe" de "no se entiende": si los números están
      // completos pero el reloj no llega ahí, el mensaje debe decirlo.
      const chunks = text
        .trim()
        .split(/[^\d]+/)
        .filter(Boolean);
      const looksComplete = chunks.length >= 2;
      return looksComplete ? 'Esa hora no existe' : 'Hora incompleta o inválida';
    }

    const iso = this.canonical(parsed.h, parsed.m, parsed.s);

    const min = this.min();
    if (min && compareTimes(iso, min) < 0) {
      return `La hora debe ser posterior a ${this.display(min)}`;
    }

    const max = this.max();
    if (max && compareTimes(iso, max) > 0) {
      return `La hora debe ser anterior a ${this.display(max)}`;
    }

    if (this.disabledTimes().some((t) => compareTimes(t, iso) === 0) || this.timeDisabled()?.(iso)) {
      return 'Esa hora no está disponible';
    }

    return '';
  }

  // --- Panel flotante ---

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  readonly open = signal(false);
  /** Evita el parpadeo: el panel no se ve hasta estar posicionado. */
  protected readonly ready = signal(false);
  protected readonly panelTop = signal(0);
  protected readonly panelLeft = signal(0);

  /**
   * El panel está portalizado a nivel de <body>, así que ya no se puede buscar
   * con un querySelector desde el host: hay que quedarse con la referencia de la
   * plantilla.
   */
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  private readonly scrollTeardown = (() => {
    const onScroll = () => this.open() && this.updatePosition();
    // Captura para que también reposicione al hacer scroll en un contenedor
    // interno, no solo en la ventana. Se excluye el scroll de las propias
    // columnas, que no mueve el panel.
    window.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll, true));
  })();

  protected toggle() {
    if (this.isDisabled() || this.readonly()) return;
    this.open() ? this.close() : this.openPanel();
  }

  /**
   * En modo solo-selección toda la caja es el trigger, no solo el reloj del
   * final. `readonly` sigue significando campo inerte: ni se teclea ni se abre
   * nada.
   */
  protected onFieldClick() {
    if (this.typeable()) return;
    this.toggle();
  }

  /**
   * Teclado del campo en modo solo-selección: se abre igual que un `ui-select`.
   * Con `typeable` no se toca nada, para no comerse el Espacio de quien escribe.
   */
  protected onFieldKeydown(event: KeyboardEvent) {
    if (this.typeable() || this.open()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.toggle();
    }
  }

  private openPanel() {
    this.ready.set(false);
    this.open.set(true);
    // afterNextRender y no requestAnimationFrame: un rAF dispara antes de que el
    // panel esté montado y lo deja mal posicionado hasta el primer resize.
    afterNextRender(
      () => {
        this.updatePosition();
        this.ready.set(true);
        this.scrollSelectedIntoView();
        this.panelEl()?.focus();
      },
      { injector: this.injector },
    );
  }

  protected close(returnFocus = true) {
    if (!this.open()) return;
    this.open.set(false);
    this.ready.set(false);
    if (returnFocus) this.textInputEl()?.focus();
  }

  private panelEl(): HTMLElement | null {
    return this.panelRef()?.nativeElement ?? null;
  }
  private textInputEl(): HTMLElement | null {
    return this.el.nativeElement.querySelector('input');
  }

  /** Centra la opción elegida de cada columna, que puede estar muy abajo. */
  private scrollSelectedIntoView() {
    const panel = this.panelEl();
    if (!panel) return;
    panel.querySelectorAll<HTMLElement>('[data-column]').forEach((column) => {
      const target = column.querySelector<HTMLElement>('[aria-selected="true"]');
      if (!target) return;
      // scrollTop a mano y no scrollIntoView: este último también desplaza la
      // página cuando el panel está cerca de un borde.
      column.scrollTop = target.offsetTop - column.clientHeight / 2 + target.offsetHeight / 2;
    });
  }

  private updatePosition() {
    const panel = this.panelEl();
    const trigger = this.el.nativeElement.querySelector('[data-trigger]') as HTMLElement | null;
    if (!panel || !trigger) return;

    const t = trigger.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const placement = positionOverlay(
      { top: t.top, left: t.left, width: t.width, height: t.height },
      { width: p.width, height: p.height },
      { width: window.innerWidth, height: window.innerHeight },
      'end',
    );

    this.panelTop.set(placement.top);
    this.panelLeft.set(placement.left);
  }

  @HostListener('window:resize')
  protected onResize() {
    if (this.open()) this.updatePosition();
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent) {
    if (!this.open()) return;
    // El panel vive fuera del host (portalizado): hay que preguntar por los dos,
    // o cualquier clic dentro de las columnas cerraría el panel.
    if (!containsTarget(event.target as Node, this.el.nativeElement, this.panelEl())) {
      this.close(false);
    }
  }

  /**
   * Teclado del panel. Va colgado del propio panel en la plantilla: al estar
   * portalizado fuera del host, un @HostListener ya no vería estas teclas.
   *
   * ↑/↓ se mueve dentro de la columna, ←/→ salta de columna, Inicio/Fin van a
   * los extremos. Enter y Espacio no se tratan aquí: las opciones son <button>,
   * el navegador ya las activa.
   */
  protected onPanelKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    const columns = Array.from(
      this.panelEl()?.querySelectorAll<HTMLElement>('[data-column]') ?? [],
    );
    if (!columns.length) return;

    const active = document.activeElement as HTMLElement | null;
    const colIndex = columns.findIndex((c) => c.contains(active));

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      // Sin foco en ninguna columna (se acaba de abrir), la primera es el punto
      // de partida natural.
      const from = colIndex === -1 ? 0 : colIndex;
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = (from + delta + columns.length) % columns.length;
      this.focusIn(columns[next], 'selected');
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (colIndex === -1) {
        this.focusIn(columns[0], 'selected');
        return;
      }
      const options = this.enabledOptions(columns[colIndex]);
      if (!options.length) return;
      const idx = options.indexOf(active as HTMLElement);
      const next =
        event.key === 'ArrowDown'
          ? (idx + 1) % options.length
          : (idx - 1 + options.length) % options.length;
      options[next].focus();
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const column = columns[colIndex === -1 ? 0 : colIndex];
      this.focusIn(column, event.key === 'Home' ? 'first' : 'last');
    }
  }

  private enabledOptions(column: HTMLElement): HTMLElement[] {
    return Array.from(
      column.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])'),
    );
  }

  private focusIn(column: HTMLElement, which: 'selected' | 'first' | 'last') {
    const options = this.enabledOptions(column);
    if (!options.length) return;
    if (which === 'first') return options[0].focus();
    if (which === 'last') return options[options.length - 1].focus();
    (options.find((o) => o.getAttribute('aria-selected') === 'true') ?? options[0]).focus();
  }

  /**
   * El panel no es modal: no hay trampa de foco, así que tabular fuera lo
   * cierra. `relatedTarget` es a dónde va el foco; si sigue dentro del host o
   * del propio panel (por ejemplo de una columna a otra) no se cierra nada.
   */
  protected onPanelFocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (containsTarget(next, this.el.nativeElement, this.panelEl())) return;
    this.close(false);
  }

  // --- ControlValueAccessor ---
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    // Basura real se normaliza a '': no hay nada que mostrar.
    const parsed = typeof value === 'string' && isValidIsoTime(value) ? parseIsoTime(value) : null;
    const iso = parsed ? this.canonical(parsed.h, parsed.m, parsed.s) : '';
    this.value.set(iso);
    this.text.set(this.display(iso));
  }
  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }
}
