import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PageNavService } from '../shared/page-nav.service';
import { ThemeService } from '../shared/theme.service';
import { BrandComponent } from '../shared/brand/brand.component';
import { ButtonComponent } from '../../components/atoms/button/button.component';

interface NavItem {
  label: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, BrandComponent, ButtonComponent],
  templateUrl: './shell.html',
})
export class Shell {
  protected readonly pageNav = inject(PageNavService);
  protected readonly theme = inject(ThemeService);

  protected readonly version = '1.7.0';

  protected readonly gettingStarted: NavItem[] = [
    { label: 'Instalación', route: '/installation' },
    { label: 'Temas', route: '/themes' },
    { label: 'Guía para IA', route: '/ai-guide' },
  ];

  protected readonly atoms: NavItem[] = [
    { label: 'Button', route: '/atoms/button' },
    { label: 'Input', route: '/atoms/input' },
    { label: 'Label', route: '/atoms/label' },
    { label: 'Badge', route: '/atoms/badge' },
    { label: 'Card', route: '/atoms/card' },
    { label: 'Modal', route: '/atoms/modal' },
    { label: 'Dialog', route: '/atoms/dialog' },
    { label: 'Drawer', route: '/atoms/drawer' },
    { label: 'Popover', route: '/atoms/popover' },
    { label: 'Separator', route: '/atoms/separator' },
    { label: 'Checkbox', route: '/atoms/checkbox' },
    { label: 'Switch', route: '/atoms/switch' },
    { label: 'Radio', route: '/atoms/radio' },
    { label: 'Segmented', route: '/atoms/segmented' },
    { label: 'Calendar', route: '/atoms/calendar' },
    { label: 'Datepicker', route: '/atoms/datepicker' },
    { label: 'Timepicker', route: '/atoms/timepicker' },
    { label: 'Timezone Select', route: '/atoms/timezone-select' },
    { label: 'Avatar', route: '/atoms/avatar' },
    { label: 'Tooltip', route: '/atoms/tooltip' },
    { label: 'Dropdown', route: '/atoms/dropdown' },
    { label: 'Select', route: '/atoms/select' },
    { label: 'Tabs', route: '/atoms/tabs' },
    { label: 'Alert', route: '/atoms/alert' },
    { label: 'Toast', route: '/atoms/toast' },
    { label: 'Loading', route: '/atoms/loading' },
    { label: 'Textarea', route: '/atoms/textarea' },
    { label: 'Phone Input', route: '/atoms/phone-input' },
    { label: 'Accordion', route: '/atoms/accordion' },
    { label: 'Breadcrumb', route: '/atoms/breadcrumb' },
    { label: 'Table', route: '/atoms/table' },
    { label: 'Pagination', route: '/atoms/pagination' },
    { label: 'Stepper', route: '/atoms/stepper' },
  ];
}
