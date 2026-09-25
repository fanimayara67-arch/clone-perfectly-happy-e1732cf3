import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GoogleFormStep } from '@/components/survey/GoogleFormStep';
const { rpc, errorToast } = vi.hoisted(() => ({ rpc: vi.fn(), errorToast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
vi.mock('sonner', () => ({ toast: { error: errorToast } }));
beforeEach(() => { cleanup(); rpc.mockReset(); errorToast.mockReset(); rpc.mockResolvedValue({ data: true, error: null }); });
describe('Formulário externo', () => {
  it('abertura persiste somente início; botão não fabrica conclusão', async () => {
    const onDone = vi.fn();
    render(<GoogleFormStep trackingCode="UFTC-ABCDEF" onDone={onDone} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('start_survey', { _tracking_code: 'UFTC-ABCDEF' }));
    expect(screen.getByRole('link', { name: /Abrir pesquisa agora/ }).getAttribute('href')).toContain('entry.1804684228=UFTC-ABCDEF');
    fireEvent.click(screen.getByRole('button', { name: 'Finalizei o Google Forms' }));
    expect(onDone).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('não esconde erro de início persistido', async () => {
    rpc.mockResolvedValue({ data: false, error: { code: '42501' } });
    render(<GoogleFormStep trackingCode="UFTC-ABCDEF" onDone={() => {}} />);
    await waitFor(() => expect(errorToast).toHaveBeenCalledOnce());
  });
});
