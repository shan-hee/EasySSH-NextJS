import React, { useState } from 'react';
import './File.css';

interface FileProps {
  color?: string;
  size?: number;
  fileType?: string;
  icon?: React.ReactNode;
  className?: string;
  isFocused?: boolean;
}

const darkenColor = (hex: string, percent: number): string => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color
      .split('')
      .map(c => c + c)
      .join('');
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

const lightenColor = (hex: string, percent: number): string => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color
      .split('')
      .map(c => c + c)
      .join('');
  }
  const num = parseInt(color, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r + (255 - r) * percent)));
  g = Math.max(0, Math.min(255, Math.floor(g + (255 - g) * percent)));
  b = Math.max(0, Math.min(255, Math.floor(b + (255 - b) * percent)));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

const File: React.FC<FileProps> = ({
  color = '#6C63FF',
  size = 1,
  fileType = '',
  icon,
  className = '',
  isFocused = false
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const fileBodyColor = color;
  const fileFoldColor = darkenColor(color, 0.15);
  const fileAccentColor = lightenColor(color, 0.2);
  const fileShadowColor = darkenColor(color, 0.3);

  const fileStyle: React.CSSProperties = {
    '--file-body-color': fileBodyColor,
    '--file-fold-color': fileFoldColor,
    '--file-accent-color': fileAccentColor,
    '--file-shadow-color': fileShadowColor,
  } as React.CSSProperties;

  const wrapperClassName = `file-wrapper ${isHovered || isFocused ? 'file-wrapper--active' : ''}`.trim();
  const fileClassName = `file ${isHovered || isFocused ? 'hover' : ''}`.trim();
  const scaleStyle = {
    transform: `scale(${size})`,
  };

  return (
    <div
      className={`${wrapperClassName} ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={scaleStyle}>
        <div className={fileClassName} style={fileStyle}>
        <div className="file__body">
          <div className="file__fold"></div>
          <div className="file__content">
            {icon && <div className="file__icon">{icon}</div>}
            {fileType && !icon && (
              <div className="file__type">{fileType}</div>
            )}
          </div>
          <div className="file__lines">
            <div className="file__line file__line--1"></div>
            <div className="file__line file__line--2"></div>
            <div className="file__line file__line--3"></div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default File;
