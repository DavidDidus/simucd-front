interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function InfoModal({ isOpen, onClose }: InfoModalProps) {
  if (!isOpen) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = '/SIMUCD-Manual-Usuario.pdf'; // Ruta relativa a public/
    link.download = 'SIMUCD-Manual-Usuario.pdf';
    link.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button 
          className="modal-close-btn"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        <h2>Acerca de SIMUCD</h2>
        <p>
          SIMUCD es un simulador de operaciones de Centro de Distribución que permite 
          proyectar y mejorar los recursos necesarios para cumplir con los volúmenes 
          de procesamiento requeridos.
        </p>

        <h3>Manual de usuario</h3>
        <button 
          onClick={handleDownload}
          className="modal-download-btn"
        >
          Descargar Manual PDF
        </button>

        <h3>Contacto</h3>
        <p> Errores, reclamos o sugerencias pueden ser enviados a:</p>
            <strong>Email:</strong>{' '}
            <a href="mailto:drodriguez@ccu.cl">drodriguez@ccu.cl</a>
        </div>
    </div>
  );
}