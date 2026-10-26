import { redondear2, sumar } from './dinero';

describe('dinero', () => {
  it('redondear2 redondea a 2 decimales', () => {
    expect(redondear2(1.005)).toBe(1.01);
    expect(redondear2(2.344)).toBe(2.34);
  });

  it('sumar evita el ruido de coma flotante e ignora vacíos', () => {
    expect(sumar([0.1, 0.2])).toBe(0.3);
    expect(sumar(['10.50', null, undefined, 4.25])).toBe(14.75);
  });
});
