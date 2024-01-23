import React, { useCallback, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
    PanGestureHandler,
    TapGestureHandler,
    State,
} from "react-native-gesture-handler";
import Reanimated, {
    Easing,
    Extrapolate,
    interpolate,
    useAnimatedStyle,
    withSpring,
    withTiming,
    useAnimatedGestureHandler,
    useSharedValue,
    withRepeat,
} from "react-native-reanimated";
import {
    CAPTURE_BUTTON_SIZE,
    SCREEN_HEIGHT,
    SCREEN_WIDTH,
} from "./../Constants";

const PAN_GESTURE_HANDLER_FAIL_X = [-SCREEN_WIDTH, SCREEN_WIDTH];
const PAN_GESTURE_HANDLER_ACTIVE_Y = [-2, 2];

const BORDER_WIDTH = CAPTURE_BUTTON_SIZE * 0.1;

const _CaptureButton = ({
    camera,
    onMediaCaptured,
    minZoom,
    maxZoom,
    cameraZoom,
    flash,
    enabled,
    setIsPressingButton,
    style,
    ...props
}) => {
    const pressDownDate = useRef(undefined);
    const takePhotoOptions = useMemo(
        () => ({
            qualityPrioritization: "speed",
            flash: flash,
            quality: 90,
            enableShutterSound: false,
        }),
        [flash]
    );
    const isPressingButton = useSharedValue(false);

    //#region Camera Capture
    const takePhoto = useCallback(async () => {
        try {
            if (camera.current == null) throw new Error("Camera ref is null!");
            const photo = await camera.current.takePhoto(takePhotoOptions);
            onMediaCaptured(photo, "photo");
        } catch (e) {
            console.error("Failed to take photo!", e);
        }
    }, [camera, onMediaCaptured, takePhotoOptions]);
    //#endregion

    //#region Tap handler
    const tapHandler = useRef();
    const onHandlerStateChanged = useCallback(
        async ({ nativeEvent: event }) => {
            console.debug(`state: ${Object.keys(State)[event.state]}`);
            switch (event.state) {
                case State.BEGAN: {
                    return;
                }
                case State.END:
                case State.FAILED:
                case State.CANCELLED: {
                    try {
                        await takePhoto();
                    } finally {
                        setTimeout(() => {
                            isPressingButton.value = false;
                            setIsPressingButton(false);
                        }, 500);
                    }
                    return;
                }
                default:
                    break;
            }
        },
        [isPressingButton, setIsPressingButton, takePhoto]
    );
    //#endregion
    //#region Pan handler
    const panHandler = useRef();
    const onPanGestureEvent = useAnimatedGestureHandler({
        onStart: (event, context) => {
            context.startY = event.absoluteY;
            const yForFullZoom = context.startY * 0.7;
            const offsetYForFullZoom = context.startY - yForFullZoom;

            // extrapolate [0 ... 1] zoom -> [0 ... Y_FOR_FULL_ZOOM] finger position
            context.offsetY = interpolate(
                cameraZoom.value,
                [minZoom, maxZoom],
                [0, offsetYForFullZoom],
                Extrapolate.CLAMP
            );
        },
        onActive: (event, context) => {
            const offset = context.offsetY ?? 0;
            const startY = context.startY ?? SCREEN_HEIGHT;
            const yForFullZoom = startY * 0.7;

            cameraZoom.value = interpolate(
                event.absoluteY - offset,
                [yForFullZoom, startY],
                [maxZoom, minZoom],
                Extrapolate.CLAMP
            );
        },
    });
    //#endregion

    const shadowStyle = useAnimatedStyle(
        () => ({
            transform: [
                {
                    scale: withSpring(isPressingButton.value ? 1 : 0, {
                        mass: 1,
                        damping: 35,
                        stiffness: 300,
                    }),
                },
            ],
        }),
        [isPressingButton]
    );
    const buttonStyle = useAnimatedStyle(() => {
        let scale;
        if (enabled) {
            if (isPressingButton.value) {
                scale = withRepeat(
                    withSpring(1, {
                        stiffness: 100,
                        damping: 1000,
                    }),
                    -1,
                    true
                );
            } else {
                scale = withSpring(0.9, {
                    stiffness: 500,
                    damping: 300,
                });
            }
        } else {
            scale = withSpring(0.6, {
                stiffness: 500,
                damping: 300,
            });
        }

        return {
            opacity: withTiming(enabled ? 1 : 0.3, {
                duration: 100,
                easing: Easing.linear,
            }),
            transform: [
                {
                    scale: scale,
                },
            ],
        };
    }, [enabled, isPressingButton]);

    return (
        <TapGestureHandler
            enabled={enabled}
            ref={tapHandler}
            onHandlerStateChange={onHandlerStateChanged}
            shouldCancelWhenOutside={false}
            maxDurationMs={99999999} // <-- this prevents the TapGestureHandler from going to State.FAILED when the user moves his finger outside of the child view (to zoom)
            simultaneousHandlers={panHandler}
        >
            <Reanimated.View {...props} style={[buttonStyle, style]}>
                <PanGestureHandler
                    enabled={enabled}
                    ref={panHandler}
                    failOffsetX={PAN_GESTURE_HANDLER_FAIL_X}
                    activeOffsetY={PAN_GESTURE_HANDLER_ACTIVE_Y}
                    onGestureEvent={onPanGestureEvent}
                    simultaneousHandlers={tapHandler}
                >
                    <Reanimated.View style={styles.flex}>
                        <Reanimated.View style={[styles.shadow, shadowStyle]} />
                        <View style={styles.button} />
                    </Reanimated.View>
                </PanGestureHandler>
            </Reanimated.View>
        </TapGestureHandler>
    );
};

export const CaptureButton = React.memo(_CaptureButton);

const styles = StyleSheet.create({
    flex: {
        flex: 1,
    },
    shadow: {
        position: "absolute",
        width: CAPTURE_BUTTON_SIZE,
        height: CAPTURE_BUTTON_SIZE,
        borderRadius: CAPTURE_BUTTON_SIZE / 2,
        backgroundColor: "#e34077",
    },
    button: {
        width: CAPTURE_BUTTON_SIZE,
        height: CAPTURE_BUTTON_SIZE,
        borderRadius: CAPTURE_BUTTON_SIZE / 2,
        borderWidth: BORDER_WIDTH,
        borderColor: "white",
    },
});
