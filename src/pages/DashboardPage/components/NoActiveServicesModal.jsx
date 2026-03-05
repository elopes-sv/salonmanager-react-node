import { useNavigate } from 'react-router-dom'

export function NoActiveServicesModal({ isOpen, hasAnyServices, onClose }) {
    const navigate = useNavigate()

    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-[520px] rounded-xl bg-white p-8 shadow-2xl">
                <h3 className="text-2xl font-bold text-slate-900">Nenhum serviço ativo</h3>
                <p className="mt-3 text-sm text-slate-600">
                    {!hasAnyServices
                        ? 'Para criar agendamentos, cadastre e ative pelo menos um serviço.'
                        : 'Para criar agendamentos, ative pelo menos um serviço na tela de Serviços.'}
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                        Fechar
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onClose()
                            navigate('/services')
                        }}
                        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
                    >
                        Ir para serviços
                    </button>
                </div>
            </div>
        </div>
    )
}
