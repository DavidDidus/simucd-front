import React from 'react';
import type { ActorType } from '../../types/actors';
import { ACTOR_DEFINITIONS } from '../../types/actors';

type Props = {
  actorCounts: Record<ActorType, number>;
  onActorCountChange: (actorType: ActorType, count: number) => void;
};

export default function ActorConfig({ actorCounts, onActorCountChange }: Props) {
  return (
    <div className="actor-config">
      <h3>Configuración de Actores</h3>
      {Object.entries(ACTOR_DEFINITIONS).map(([type, definition]) => (
        <div key={type} className="actor-input">
          <label>
            {definition.name}:
            <input
              type="number"
              min="0"
              max="10"
              value={actorCounts[type as ActorType]}
              onChange={(e) => onActorCountChange(
                type as ActorType,
                parseInt(e.target.value) || 0
              )}
            />
          </label>
        </div>
      ))}
    </div>
  );
}