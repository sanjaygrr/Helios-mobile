// Shim for react-native-reanimated to bypass native crashes
// This file mocks the API so components can import it without failing.

const Reanimated = {
    // Mock Core
    isConfigured: () => true,

    // Mock Hooks
    useSharedValue: (initialValue) => ({ value: initialValue }),
    useAnimatedStyle: (cb) => cb(),
    useDerivedValue: (cb) => ({ value: cb() }),
    useAnimatedScrollHandler: () => () => { },
    useAnimatedGestureHandler: () => () => { },
    useAnimatedProps: (cb) => cb(),
    useWorkletCallback: (cb) => cb,

    // Mock Animation Functions
    withTiming: (toValue) => toValue,
    withSpring: (toValue) => toValue,
    withDecay: () => 0,
    withDelay: (_, animation) => animation,
    withSequence: (...animations) => animations[animations.length - 1],
    withRepeat: (animation) => animation,
    interpolate: (value, inputBox, outputBox) => outputBox[0], // Mock interpolation
    Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },

    // Mock Core Functions
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    createAnimatedComponent: (component) => component,

    // Mock Components
    View: require('react-native').View,
    Text: require('react-native').Text,
    Image: require('react-native').Image,
    ScrollView: require('react-native').ScrollView,
};

module.exports = {
    __esModule: true,
    default: Reanimated,
    ...Reanimated,
};
