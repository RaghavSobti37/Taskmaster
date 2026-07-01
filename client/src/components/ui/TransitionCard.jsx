import React from 'react';
import { useCardTilt } from '../../hooks/transitions';

/**
 * Optional 3D hover tilt wrapper (transitions.dev card-tilt).
 * Use on clickable metric / list / product cards.
 */
export default function TransitionCard({
  children,
  className = '',
  innerClassName = '',
  glare = true,
  maxDeg = 10,
  as: Tag = 'div',
  ...props
}) {
  const { wrapRef, cardRef, pointerProps } = useCardTilt({ maxDeg, glare });

  return (
    <Tag ref={wrapRef} className={`t-tilt ${className}`} {...pointerProps} {...props}>
      <div ref={cardRef} className={`t-tilt-card ${innerClassName}`}>
        {glare ? <div className="t-tilt-glare" aria-hidden /> : null}
        {children}
      </div>
    </Tag>
  );
}
