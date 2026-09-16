import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { brandSplashBackground, fonts } from '@/theme/tokens';

import { LogoMark } from './logo-mark';

/** Minimum time the branded splash stays up, so it never just flickers. */
const MIN_VISIBLE_MS = 900;
/** Ring diameter of the mark in the native splash (imageWidth 160 × mark ratio). */
const MARK_SIZE = 133;

/**
 * Continues the native splash screen (same background and mark position) while the
 * database opens, then animates away. Rendered above the whole app.
 */
export function AnimatedSplash({ ready, onFinish }: { ready: boolean; onFinish: () => void }) {
  const reduceMotion = useReducedMotion();
  const [mountedAt] = useState(() => Date.now());
  const pulse = useSharedValue(1);
  const intro = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    intro.set(withDelay(150, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })));
    pulse.set(
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 700, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        false,
        undefined,
        ReduceMotion.System
      )
    );
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(intro);
    };
  }, [intro, pulse]);

  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_VISIBLE_MS - (Date.now() - mountedAt));
    const timer = setTimeout(() => {
      cancelAnimation(pulse);
      exit.set(
        withTiming(
          1,
          { duration: reduceMotion ? 150 : 450, easing: Easing.inOut(Easing.cubic) },
          (finished) => {
            if (finished) scheduleOnRN(onFinish);
          }
        )
      );
    }, wait);
    return () => clearTimeout(timer);
  }, [ready, mountedAt, exit, pulse, onFinish, reduceMotion]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.get() }));
  const markStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() * (1 + exit.get() * 0.35) }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: intro.get() * (1 - exit.get()),
    transform: [{ translateY: (1 - intro.get()) * 12 }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.container, containerStyle]}
      pointerEvents={ready ? 'none' : 'auto'}
      accessibilityLabel="Loading Selftage">
      <Animated.View style={markStyle}>
        <LogoMark size={MARK_SIZE} />
      </Animated.View>
      <Animated.View style={[styles.titleWrap, titleStyle]}>
        <Text style={styles.title}>Selftage</Text>
        <Text style={styles.tagline}>Your money, crystal clear</Text>
      </Animated.View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>Private · Offline · On your device</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: brandSplashBackground,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  titleWrap: {
    position: 'absolute',
    top: '50%',
    marginTop: MARK_SIZE / 2 + 28,
    alignItems: 'center',
    gap: 6,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.6,
    fontFamily: fonts.bold,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 15,
    fontFamily: fonts.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 48,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 12,
    letterSpacing: 0.4,
    fontFamily: fonts.medium,
  },
});
