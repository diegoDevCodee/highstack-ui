import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  booleanAttribute,
  computed,
  contentChildren,
  forwardRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LabelComponent } from '../label/label.component';
import { containsTarget } from '../../shared/overlay-container';
import { OverlayPortalDirective } from '../../shared/overlay-portal.directive';

export type SelectSize = 'sm' | 'md' | 'lg';

/** Margen mínimo al borde del viewport (px). */
const MARGIN = 8;

interface SelectValidationError {
  kind?: string;
  message?: string;
}

let nextId = 0;

/**
 * Select compositional, sin dependencias. Combina el overlay del Dropdown con
 * la integración de formularios del Input: Signal Forms (`[formField]`),
 * ControlValueAccessor (ngModel/Reactive) y two-way `[(value)]`.
 */
@Component({
  selector: 'ui-select',
  templateUrl: './select.component.html',
  imports: [LabelComponent, OverlayPortalDirective],
  host: { class: 'block' },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => SelectComponent), multi: true },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  readonly value = model<string>('');

  readonly placeholder = input<string>('Selecciona…');
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly error = input<string>('');
  readonly size = input<SelectSize>('md');
  readonly id = input<string>(`ui-select-${nextId++}`);

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly errors = input<readonly SelectValidationError[]>([]);

  readonly open = signal(false);
  /** Oculta el panel un frame hasta posicionarlo, para que no salte. */
  protected readonly ready = signal(false);
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly injector = inject(Injector);
  private readonly options = contentChildren(OptionComponent);

  constructor() {
    // Capture=true reposiciona también con scroll de contenedores internos.
    const onScroll = () => {
      if (this.open()) this.updatePosition();
    };
    window.addEventListener('scroll', onScroll, true);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('scroll', onScroll, true));
  }

  private readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());

  protected readonly errorMessage = computed(() => {
    if (this.error()) return this.error();
    if (this.touched()) {
      const first = this.errors()[0];
      if (first) return first.message ?? first.kind ?? 'Campo inválido';
    }
    return '';
  });
  protected readonly hasError = computed(
    () => !!this.errorMessage() || (this.invalid() && this.touched()),
  );

  protected readonly selectedLabel = computed(() => {
    const v = this.value();
    const opt = this.options().find((o) => o.value() === v);
    return opt ? opt.getLabel() : '';
  });

  protected readonly triggerClasses = computed(() => {
    const sizeMap: Record<SelectSize, string> = {
      sm: 'h-8 px-2.5 text-xs rounded-lg',
      md: 'h-9 px-3 text-sm rounded-[10px]',
      lg: 'h-10 px-3.5 text-base rounded-[10px]',
    };
    const base =
      'flex w-full items-center justify-between gap-2 border bg-[var(--color-background)] transition-all outline-none cursor-pointer text-left';
    const state = this.hasError()
      ? 'border-[var(--color-destructive)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-destructive)]/25'
      : 'border-[var(--color-input)] focus-visible:border-[var(--color-ring)] focus-visible:ring-[3px] focus-visible:ring-[var(--color-ring)]/40';
    const disabled = this.isDisabled()
      ? 'opacity-50 cursor-not-allowed bg-[var(--color-muted)]/40'
      : '';
    return [base, sizeMap[this.size()], state, disabled].join(' ');
  });

  /** Solo apunta a un `<p>` que realmente se renderiza (error con texto o hint). */
  protected readonly describedById = computed(() =>
    this.errorMessage() || this.hint() ? `${this.id()}-desc` : null,
  );

  toggle() {
    if (this.isDisabled()) return;
    if (this.open()) {
      this.close();
      return;
    }
    this.ready.set(false);
    this.open.set(true);
    // El panel no se crea al abrir (vive siempre en el DOM), así que hay que
    // reinsertarlo al final del contenedor de overlays o quedaría por debajo de
    // los que se abrieron después — el popover o el drawer que lo contiene.
    this.portal()?.bringToFront();
    // `afterNextRender` garantiza que el panel ya esté visible en el DOM (sin
    // depender del timing del ciclo de detección de cambios) antes de medirlo y
    // posicionarlo; de lo contrario podía quedar invisible hasta un resize.
    afterNextRender(
      () => {
        this.updatePosition();
        this.focusActive();
      },
      { injector: this.injector },
    );
  }

  close() {
    this.open.set(false);
    this.ready.set(false);
  }

  /**
   * El panel está portalizado a nivel de <body>, así que ya no se puede buscar
   * con un querySelector desde el host: hay que quedarse con la referencia de la
   * plantilla.
   */
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly portal = viewChild('panel', { read: OverlayPortalDirective });

  private panel(): HTMLElement | null {
    return this.panelRef()?.nativeElement ?? null;
  }

  private triggerEl(): HTMLElement | null {
    return this.el.nativeElement.querySelector('[data-trigger]');
  }

  /**
   * Posiciona el panel `fixed` bajo el trigger (o encima si no cabe), del ancho
   * del trigger, y lo fija a los bordes del viewport. Escapa cualquier ancestro
   * con overflow para que se sobreponga a todo.
   */
  private updatePosition() {
    const panel = this.panel();
    const trigger = this.triggerEl();
    if (!panel || !trigger || !this.open()) return;

    const host = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 6;

    // Fijar el ancho al del trigger ANTES de medir la altura (evita medir mal).
    panel.style.width = `${host.width}px`;
    const rect = panel.getBoundingClientRect();

    const spaceBelow = vh - host.bottom;
    const spaceAbove = host.top;
    const openUp = spaceBelow < rect.height + GAP + MARGIN && spaceAbove > spaceBelow;

    let top = openUp ? host.top - rect.height - GAP : host.bottom + GAP;
    let left = Math.max(MARGIN, Math.min(host.left, vw - host.width - MARGIN));
    top = Math.max(MARGIN, Math.min(top, vh - rect.height - MARGIN));

    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    this.ready.set(true);
  }

  /** Llamado por una ui-option al elegirse. */
  choose(v: string) {
    this.value.set(v);
    this.onChange(v);
    this.onTouched();
    this.close();
    this.triggerEl()?.focus();
  }

  @HostListener('document:click', ['$event'])
  protected onDocClick(event: MouseEvent) {
    if (!this.open()) return;
    // El panel vive fuera del host (portalizado): hay que preguntar por los dos,
    // o elegir una opción cerraría el panel antes de registrar el clic.
    if (!containsTarget(event.target as Node, this.el.nativeElement, this.panel())) this.close();
  }

  @HostListener('window:resize')
  protected onViewportChange() {
    if (this.open()) this.updatePosition();
  }

  /**
   * Teclas con el panel CERRADO. Vive en el host porque el foco está en el
   * trigger, que sí es descendiente suyo.
   */
  @HostListener('keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent) {
    if (this.open()) return;
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggle();
    }
  }

  /**
   * Teclas con el panel ABIERTO. Va colgado del propio panel en la plantilla: al
   * estar portalizado fuera del host, un @HostListener ya no vería las teclas
   * pulsadas con el foco dentro del panel.
   */
  protected onPanelKeydown(event: KeyboardEvent) {
    if (!this.open()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      // El foco estaba dentro del panel, que se va: hay que devolverlo al trigger.
      this.triggerEl()?.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const enabled = this.options().filter((o) => !o.disabled());
      if (!enabled.length) return;
      const active = document.activeElement;
      const idx = enabled.findIndex((o) => o.isActive(active));
      const next =
        event.key === 'ArrowDown'
          ? (idx + 1) % enabled.length
          : (idx - 1 + enabled.length) % enabled.length;
      enabled[next].focus();
    }
  }

  private focusActive() {
    setTimeout(() => {
      const opts = this.options().filter((o) => !o.disabled());
      const sel = opts.find((o) => o.value() === this.value());
      // Solo se enfoca (resalta) la opción ya elegida. Si no hay ninguna, se
      // enfoca el panel para no marcar la primera opción por defecto.
      if (sel) sel.focus();
      else this.panel()?.focus();
    });
  }

  // --- ControlValueAccessor ---
  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value.set(value ?? '');
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

/** Opción dentro de ui-select. */
@Component({
  selector: 'ui-option',
  template: `
    <span class="flex-1"><ng-content /></span>
    @if (selected()) {
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--color-primary)]"><polyline points="20 6 9 17 4 12" /></svg>
    }
  `,
  host: {
    role: 'option',
    tabindex: '-1',
    '[attr.aria-selected]': 'selected()',
    '[attr.aria-disabled]': 'disabled() || null',
    '(click)': 'onClick()',
    '[class]': 'hostClasses()',
  },
})
export class OptionComponent {
  readonly value = input.required<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly select = inject(SelectComponent);
  private readonly el = inject(ElementRef<HTMLElement>);

  protected readonly selected = computed(() => this.select.value() === this.value());

  protected readonly hostClasses = computed(() => {
    const base =
      'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer select-none outline-none transition-colors text-[var(--color-foreground)]';
    const state = this.disabled()
      ? 'opacity-50 pointer-events-none'
      : 'hover:bg-[var(--color-accent)] focus-visible:bg-[var(--color-accent)] focus-visible:ring-1 focus-visible:ring-[var(--color-ring)]';
    return [base, state].join(' ');
  });

  getLabel() {
    return this.el.nativeElement.textContent?.trim() ?? '';
  }
  focus() {
    this.el.nativeElement.focus();
  }
  isActive(node: Element | null) {
    return node === this.el.nativeElement;
  }

  protected onClick() {
    if (this.disabled()) return;
    this.select.choose(this.value());
  }
}
