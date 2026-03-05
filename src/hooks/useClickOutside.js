import { useEffect } from 'react'

/**
 * Hook que detecta cliques fora de um elemento referenciado.
 * @param {import('react').RefObject} ref - Ref do elemento a monitorar
 * @param {Function} handler - Callback executado ao clicar fora
 * @param {boolean} [active=true] - Se o listener está ativo
 */
export function useClickOutside(ref, handler, active = true) {
    useEffect(() => {
        if (!active) {
            return
        }

        function handleMouseDown(event) {
            if (ref.current && !ref.current.contains(event.target)) {
                handler(event)
            }
        }

        document.addEventListener('mousedown', handleMouseDown)
        return () => {
            document.removeEventListener('mousedown', handleMouseDown)
        }
    }, [ref, handler, active])
}
