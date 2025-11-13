import { useState } from 'react';
import type { Point } from '../../../types';
import type { ObstacleType } from '../../../types/obstacles';

type Props = {
  points: Point[];
  onClose: () => void;
};

const OBSTACLE_TYPES: { value: ObstacleType; label: string }[] = [
  { value: 'building', label: 'Edificio' },
  { value: 'container', label: 'Contenedor' },
  { value: 'machinery', label: 'Maquinaria' },
  { value: 'zone', label: 'Zona Restringida' },
  { value: 'custom', label: 'Personalizado' }
];

export default function SaveObstacleModal({ points, onClose }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ObstacleType>('custom');
  const [color, setColor] = useState('#FF6B6B');
  const [copying, setCopying] = useState(false);

  // 🆕 Función para copiar al portapapeles
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      // Método moderno (si está disponible)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Método fallback para navegadores más antiguos
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const result = document.execCommand('copy');
        document.body.removeChild(textArea);
        return result;
      }
    } catch (error) {
      console.error('Error al copiar al portapapeles:', error);
      return false;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Por favor ingresa un nombre para el obstáculo');
      return;
    }

    setCopying(true);

    // Generar ID único
    const id = `obstacle-${Date.now()}`;
    
    const obstacleData = {
      id,
      name: name.trim(),
      description: description.trim(),
      type,
      points: [...points],
      color,
      radius: 0.05
    };

    // 🆕 Crear el JSON formateado para copiar
    const jsonForClipboard = JSON.stringify(obstacleData, null, 2);
    
    // 🆕 Intentar copiar al portapapeles
    const copied = await copyToClipboard(jsonForClipboard);
    
    setCopying(false);

    if (copied) {
      // Mostrar mensaje de éxito con instrucciones
      alert(
        `✅ Obstáculo "${name}" creado y copiado al portapapeles!\n\n` +
        `📋 El JSON ha sido copiado automáticamente.\n` +
        `📝 Pégalo en tu archivo obstacles.json dentro del array "obstacles".\n\n` +
        `💡 Recuerda agregar una coma (,) si no es el último elemento del array.`
      );
    } else {
      // Fallback: mostrar en consola si la copia falló
      console.log('Obstáculo para guardar:', obstacleData);
      console.log('JSON para obstacles.json:', jsonForClipboard);
      
      alert(
        `⚠️ Obstáculo "${name}" creado, pero no se pudo copiar automáticamente.\n\n` +
        `📋 Revisa la consola del navegador para obtener el JSON.\n` +
        `📝 Cópialo manualmente a tu archivo obstacles.json.`
      );
    }
    
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        minWidth: '400px',
        maxWidth: '500px'
      }}>
        <h3>Guardar Obstáculo</h3>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Nombre del obstáculo:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej: Edificio Principal"
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Descripción:
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción del obstáculo..."
            rows={3}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Tipo de obstáculo:
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ObstacleType)}
            style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            {OBSTACLE_TYPES.map(obstacleType => (
              <option key={obstacleType.value} value={obstacleType.value}>
                {obstacleType.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Color:
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ padding: '4px', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '15px', fontSize: '12px', color: '#666' }}>
          Puntos: {points.length} | Mínimo requerido: 3
        </div>

        {/* 🆕 Información sobre la copia automática */}
        <div style={{ 
          marginBottom: '15px', 
          fontSize: '11px', 
          color: '#007bff',
          background: '#f0f8ff',
          padding: '8px',
          borderRadius: '4px',
          border: '1px solid #bee5eb'
        }}>
          💡 <strong>Copia automática:</strong> Al guardar, el JSON se copiará automáticamente al portapapeles para que puedas pegarlo directamente en obstacles.json
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={copying}
            style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: 'white',
              cursor: copying ? 'not-allowed' : 'pointer',
              opacity: copying ? 0.6 : 1
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={points.length < 3 || !name.trim() || copying}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              background: (points.length >= 3 && name.trim() && !copying) ? '#007bff' : '#ccc',
              color: 'white',
              cursor: (points.length >= 3 && name.trim() && !copying) ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            {copying ? (
              <>
                <span>📋</span>
                Copiando...
              </>
            ) : (
              <>
                <span>💾</span>
                Guardar y Copiar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}