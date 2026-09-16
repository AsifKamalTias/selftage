import Svg, { Circle, Rect } from 'react-native-svg';

/**
 * Vector version of the app icon mark (coin ring + ascending bars). The viewBox is
 * cropped to the ring's outer edge, so `size` equals the ring's outer diameter.
 * Geometry must stay in sync with the icon generator used for assets/images.
 */
export function LogoMark({ size = 64, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="16.75 16.75 66.5 66.5">
      <Circle cx={50} cy={50} r={30} stroke={color} strokeWidth={6.5} fill="none" />
      <Rect x={35.5} y={52} width={7} height={10} rx={3.5} fill={color} />
      <Rect x={46.5} y={45} width={7} height={17} rx={3.5} fill={color} />
      <Rect x={57.5} y={37} width={7} height={25} rx={3.5} fill={color} />
    </Svg>
  );
}
