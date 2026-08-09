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
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CalendarComponent } from '../calendar/calendar.component';
import { InputComponent } from '../input/input.component';
import { formatForDisplay, isValidIso, parseLocalized } from '../calendar/date-utils';
import { positionOverlay } from '../../shared/overlay-position';
import { containsTarget } from '../../shared/overlay-container';
import { OverlayPortalDirective } from '../../shared/overlay-portal.directive';

export type DatepickerSize = 'sm' | 'md' | 'lg';

/** Forma laxa de un error de validación (Signal Forms entrega { kind, message? }). */
interface DatepickerValidationError {
  kind?: string;
  message?: string;
}

let nextId = 0;

/**
 * Selector de fecha: compone ui-input (para el campo, el label y el mensaje) con
 * ui-calendar (para el panel).
 *
 * Mantiene DOS fuentes de verdad sincronizadas: `value` (ISO, lo que ve el
 * formulario) y `text` (lo que hay en la caja). Las reglas de esa sincronía son
 * la parte delicada del componente y están documentadas en cada método.
 */
@Component({
  selector: 'ui-datepicker',
  templateUrl: './datepicker.component.html',
  imports: [InputComponent, CalendarComponent, OverlayPortalDirective],
  host: { class: 'block' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DatepickerComponent), multi: true },
  ],
})
export class DatepickerComponent implements ControlValueAccessor {
  /** Fecha en ISO 'YYYY-MM-DD', o '' si no hay. */
  readonly value = model<string>('');

  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly placeholder = input<string>('');
  readonly name = input<string>('');
  readonly id = input<string>(`ui-datepicker-${nextId++}`);
  readonly size = input<DatepickerSize>('md');

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });

  /**
   * Permite escribir la fecha a mano.
   *
   * Por defecto está apagado: el campo entero se comporta como el trigger de un
   * select — un clic en cualquier parte abre el calendario y no se puede
   * teclear. Ponlo a `true` para recuperar el campo de texto con su parseo
   * (`31/12/2026`, `31-12-26`…), que sigue siendo más rápido para fechas
   * lejanas como una de nacimiento.
   */
  readonly typeable = input(false, { transform: booleanAttribute });

  /** Mensaje de error manual (tiene prioridad sobre todo lo demás). */
  readonly error = input<string>('');
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly DatepickerValidationError[]>([]);

  // Reenviados al calendario.
  readonly locale = input<string>('es-MX');
  readonly weekStartsOn = input<number | undefined>(undefined);
  // Signal Forms escribe `min`/`max` como `string | undefined` al cablear
  // [formField]; el transform los normaliza a '' para que dentro siempre sean
  // string y las comparaciones lexicográficas no tengan que defenderse.
  readonly min = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly max = input('', { transform: (v: string | undefined) => v ?? '' });
  readonly disabledDates = input<readonly string[]>([]);
  readonly dateDisabled = input<((iso: string) => boolean) | undefined>(undefined);

  /** Lo que hay literalmente en la caja de texto. */
  protected readonly text = signal<string>('');
  /** ¿El usuario ya editó el texto? Ver `onBlur`. */
  private dirty = false;
  private focusedField = false;
  /** Error de parseo/restricción, revelado solo tras blur o Enter. */
  protected readonly parseError = signal<string>('');

  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  constructor() {
    // El valor puede cambiar desde afuera (writeValue, [(value)], formField).
    // Reformatear mientras el campo tiene foco movería el caret bajo el cursor,
    // así que solo se sincroniza cuando no está enfocado.
    effect(() => {
      const iso = this.value();
      if (this.focusedField) return;
      this.text.set(formatForDisplay(iso, this.locale()));
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

  // --- Sincronización texto -> valor ---

  protected onTextInput(next: string) {
    this.dirty = true;
    this.text.set(next);
    // Al teclear NUNCA se muestra error: '31/0' es un estado de camino válido.
    this.parseError.set('');

    const iso = parseLocalized(next, this.locale());
    this.value.set(iso && !this.violates(iso) ? iso : '');
    this.onChange(this.value());
  }

  protected onFocus() {
    this.focusedField = true;
  }

  /**
   * Al salir del campo se revela el error, si lo hay.
   *
   * Solo se valida texto que el usuario editó: si el valor vino de afuera y
   * nadie tecleó, pasar con Tab por un formulario precargado no debe borrar
   * nada ni marcar error.
   */
  protected onBlur() {
    this.focusedField = false;
    this.onTouched();

    if (!this.dirty) {
      this.text.set(formatForDisplay(this.value(), this.locale()));
      return;
    }

    this.parseError.set(this.validateText(this.text()));
    if (!this.parseError() && this.value()) {
      this.text.set(formatForDisplay(this.value(), this.locale()));
    }
  }

  /** Devuelve el mensaje adecuado, o '' si el texto está bien. */
  private validateText(text: string): string {
    if (!text.trim()) return '';

    const iso = parseLocalized(text, this.locale());
    if (!iso) {
      // Distinguir "no existe" de "no se entiende": si los tres números están
      // completos pero la fecha no existe, el mensaje debe decirlo.
      const chunks = text
        .trim()
        .split(/[^\d]+/)
        .filter(Boolean);
      const looksComplete = chunks.length === 3 && chunks.some((c) => c.length === 4);
      return looksComplete ? 'Esa fecha no existe' : 'Fecha incompleta o inválida';
    }

    const min = this.min();
    if (min && iso < min) {
      return `La fecha debe ser posterior a ${formatForDisplay(min, this.locale())}`;
    }

    const max = this.max();
    if (max && iso > max) {
      return `La fecha debe ser anterior a ${formatForDisplay(max, this.locale())}`;
    }

    if (this.disabledDates().includes(iso) || this.dateDisabled()?.(iso)) {
      return 'Esa fecha no está disponible';
    }

    return '';
  }

  private violates(iso: string): boolean {
    return this.validateText(formatForDisplay(iso, this.locale())) !== '';
  }

  /** Elegir del calendario siempre produce una fecha válida. */
  protected onCalendarPick(iso: string) {
    this.dirty = true;
    this.value.set(iso);
    this.text.set(formatForDisplay(iso, this.locale()));
    this.parseError.set('');
    this.onChange(iso);
    this.onTouched();
    // Elegir un día es la acción terminal del panel: se cierra y el foco vuelve
    // al campo, que es de donde salió.
    this.close();
  }

  // --- Panel flotante ---

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);

  readonly open = signal(false);
  /** Evita el parpadeo: el panel no se ve hasta estar posicionado. */
  protected readonly ready = signal(false);
  protected readonly panelTop = signal(0);
  protected readonly panelLeft = signal(0);

  private readonly scrollTeardown = (() => {
    const onScroll = () => this.open() && this.updatePosition();
    // Captura para que también reposicione al hacer scroll en un contenedor
    // interno, no solo en la ventana.
    window.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll, true));
  })();

  protected toggle() {
    if (this.isDisabled() || this.readonly()) return;
    this.open() ? this.close() : this.openPanel();
  }

  /**
   * En modo solo-selección toda la caja es el trigger, no solo el iconito del
   * calendario. `readonly` sigue significando campo inerte: ni se teclea ni se
   * abre nada.
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
    // afterNextRender y no requestAnimationFrame: un rAF dispara antes de que
    // el panel esté montado y lo deja mal posicionado hasta el primer resize.
    afterNextRender(
      () => {
        this.updatePosition();
        this.ready.set(true);
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

  /**
   * El panel está portalizado a nivel de <body>, así que ya NO se puede buscar
   * con un querySelector desde el host: hay que quedarse con la referencia de la
   * plantilla.
   */
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  private panelEl(): HTMLElement | null {
    return this.panelRef()?.nativeElement ?? null;
  }
  private textInputEl(): HTMLElement | null {
    return this.el.nativeElement.querySelector('input');
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
    // El panel vive fuera del host (portalizado), así que hay que preguntar por
    // los dos: si no, cualquier clic dentro del calendario cerraría el panel.
    if (!containsTarget(event.target as Node, this.el.nativeElement, this.panelEl())) {
      this.close(false);
    }
  }

  protected onPanelKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    }
  }

  /**
   * El panel no es modal: no hay trampa de foco, así que tabular fuera lo
   * cierra. `relatedTarget` es a dónde va el foco; si sigue dentro del host o
   * del propio panel (por ejemplo del grid al botón de mes siguiente) no se
   * cierra nada.
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
    const iso = typeof value === 'string' && isValidIso(value) ? value : '';
    this.value.set(iso);
    this.text.set(formatForDisplay(iso, this.locale()));
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
