import React, { useRef, useEffect } from 'react';

interface AnimatedActiveDotProps {
  cx?: number;
  cy?: number;
  r?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  animationDuration?: number;
  // Recharts 传递的额外 props，需要过滤掉
  dataKey?: string;
  payload?: any;
  value?: any;
  index?: number;
  [key: string]: any;
}

/**
 * 自定义激活点组件，带有淡入淡出和缩放动画
 * 使用 Web Animations API 实现真正的动画效果
 * 每次位置改变时都会重新触发动画
 */
export const AnimatedActiveDot: React.FC<AnimatedActiveDotProps> = ({
  cx = 0,
  cy = 0,
  r = 4,
  fill = 'currentColor',
  stroke = 'none',
  strokeWidth = 0,
  animationDuration = 300,
  // 过滤掉 Recharts 传递的非 DOM 属性
  dataKey,
  payload,
  value,
  index,
  ...props
}) => {
  const circleRef = useRef<SVGCircleElement>(null);

  // 当位置或半径改变时，重新触发动画
  useEffect(() => {
    if (!circleRef.current) return;

    const circle = circleRef.current;

    // 使用 Web Animations API 实现淡入淡出和缩放
    const animation = circle.animate(
      [
        { r: '0', opacity: '0' },
        { r: r.toString(), opacity: '1' }
      ],
      {
        duration: animationDuration,
        easing: 'ease',
        fill: 'forwards'
      }
    );

    return () => {
      animation.cancel();
    };
  }, [cx, cy, r, animationDuration]); // 依赖 cx, cy 以便位置改变时重新触发

  return (
    <circle
      ref={circleRef}
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
};
