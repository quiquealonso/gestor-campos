import { Routes } from '@angular/router';
import { VistaGeneralComponent } from './components/vista-general/vista-general';
import { VistaCampoComponent } from './components/vista-campo/vista-campo';
import { VistaGastosComponent } from './components/vista-gastos/vista-gastos';
import { VistaIngresosComponent } from './components/vista-ingresos/vista-ingresos';
import { VistaComparativaComponent } from './components/vista-comparativa/vista-comparativa';
import { VistaEvolucionComponent } from './components/vista-evolucion/vista-evolucion';
import { VistaCategoriasComponent } from './components/vista-categorias/vista-categorias';
import { LoginComponent } from './components/login/login';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [loginGuard] },
  { path: '', component: VistaGeneralComponent, canActivate: [authGuard] },
  { path: 'vista-campo', component: VistaCampoComponent, canActivate: [authGuard] },
  { path: 'campos/:id', component: VistaCampoComponent, canActivate: [authGuard] },
  { path: 'gastos', component: VistaGastosComponent, canActivate: [authGuard] },
  { path: 'ingresos', component: VistaIngresosComponent, canActivate: [authGuard] },
  { path: 'estadisticas', component: VistaComparativaComponent, canActivate: [authGuard] },
  { path: 'estadisticas/anios', component: VistaEvolucionComponent, canActivate: [authGuard] },
  { path: 'comparativa', redirectTo: 'estadisticas' },
  { path: 'categorias', component: VistaCategoriasComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
