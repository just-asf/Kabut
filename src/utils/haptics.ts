import { Vibration } from 'react-native';

/**
 * Triggers success haptic feedback: double short vibration.
 */
export function triggerSuccessHaptic() {
  Vibration.vibrate([0, 80, 80, 80]);
}

/**
 * Triggers failure haptic feedback: single longer vibration.
 */
export function triggerFailureHaptic() {
  Vibration.vibrate(200);
}

/**
 * Triggers cooldown haptic feedback: single very soft vibration.
 */
export function triggerCooldownHaptic() {
  Vibration.vibrate(40);
}
