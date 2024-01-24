import "react-native-gesture-handler";

import * as React from "react";
import { useRef, useState, useCallback, useMemo } from "react";
import { Alert, Linking, StyleSheet, Text, View, Modal, Image, TouchableOpacity } from "react-native";
import {
    PinchGestureHandler,
    TapGestureHandler,
} from "react-native-gesture-handler";
import {
    useCameraDevice,
    useCameraFormat,
    useCodeScanner
} from "react-native-vision-camera";
import { Camera } from "react-native-vision-camera";
import {
    CONTENT_SPACING,
    CONTROL_BUTTON_SIZE,
    MAX_ZOOM_FACTOR,
    SAFE_AREA_PADDING,
    SCREEN_HEIGHT,
    SCREEN_WIDTH,
} from "./Constants";
import Reanimated, {
    Extrapolate,
    interpolate,
    useAnimatedGestureHandler,
    useAnimatedProps,
    useSharedValue,
} from "react-native-reanimated";
import { useEffect } from "react";
import { useIsForeground } from "./hooks/useIsForeground";
import { usePreferredCameraDevice } from "./hooks/usePreferredCameraDevice";
import { CaptureButton } from "./views/CaptureButton";
import { StatusBarBlurBackground } from "./views/StatusBarBlurBackground";
import { PressableOpacity } from "react-native-pressable-opacity";
import MaterialIcon from "react-native-vector-icons/MaterialCommunityIcons";
import IonIcon from "react-native-vector-icons/Ionicons";
import { useIsFocused } from "@react-navigation/core";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import ModalAPP from "./Modal";

import { CameraRoll } from '@react-native-camera-roll/camera-roll'

const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);
Reanimated.addWhitelistedNativeProps({
    zoom: true,
});
const SCALE_FULL_ZOOM = 3;

const showCodeAlert = (value, onDismissed) => {
    const buttons = [
        {
            text: "Close",
            style: "cancel",
            onPress: onDismissed,
        },
    ];
    if (value.startsWith("http")) {
        buttons.push({
            text: "Open URL",
            onPress: () => {
                Linking.openURL(value);
                onDismissed();
            },
        });
    }
    Alert.alert("Scanned Code", value, buttons);
};

export default function App({ navigation }) {
    // Referências
    const camera = useRef(null);

    // Estados
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const hasMicrophonePermission = useMemo(
        () => Camera.getMicrophonePermissionStatus() === "granted",
        []
    );
    const zoom = useSharedValue(0);
    const isPressingButton = useSharedValue(false);
    const [cameraPermission, setCameraPermission] = useState(false);
    const [storagePermission, setStoragePermission] = useState(false);
    const [modalVisible, setModalVisible] = useState(false); // modal de erro
    const [modalTitle, setModalTitle] = useState(""); // modal de erro
    const [modalText, setModalText] = useState(""); // modal de erro
    const [capturedPhoto, setCapturedPhoto] = useState(null); // foto capturada

    // Verifica se a página da câmera está ativa
    const isFocussed = useIsFocused();
    const isForeground = useIsForeground();
    const isActive = isFocussed && isForeground;

    // Configurações da câmera
    const [cameraPosition, setCameraPosition] = useState("back");
    const [enableHdr, setEnableHdr] = useState(false);
    const [flash, setFlash] = useState("off");
    const [enableNightMode, setEnableNightMode] = useState(false);

    // Configurações do dispositivo de câmera
    const [preferredDevice] = usePreferredCameraDevice();
    let device = useCameraDevice(cameraPosition);

    if (
        preferredDevice != null &&
        preferredDevice.position === cameraPosition
    ) {
        // Sobrescreve o dispositivo padrão com o selecionado pelo usuário nas configurações
        device = preferredDevice;
    }

    const [targetFps, setTargetFps] = useState(60);

    const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
    const format = useCameraFormat(device, [
        { fps: targetFps },
        { videoAspectRatio: screenAspectRatio },
        { videoResolution: "max" },
        { photoAspectRatio: screenAspectRatio },
        { photoResolution: "max" },
    ]);

    const fps = Math.min(format?.maxFps ?? 1, targetFps);

    const supportsFlash = useMemo(
        () => device?.hasFlash ?? false,
        [device?.hasFlash]
    );
    const supportsHdr = useMemo(
        () => format?.supportsPhotoHdr ?? false,
        [format?.supportsPhotoHdr]
    );
    const canToggleNightMode = useMemo(
        () => device?.supportsLowLightBoost ?? false,
        [device?.supportsLowLightBoost]
    );
    const supports60Fps = useMemo(
        () => device?.formats.some((f) => f.maxFps >= 60),
        [device?.formats]
    );

    /**
     * ZOOM => INICIO
     */
    // Isso mapeia o fator de zoom para um valor percentual.
    // Para valores [mín., neutro, máx.] como [1, 2, 128], isso resultaria em [0, 0.0081, 1]
    const minZoom = device?.minZoom ?? 1;
    const maxZoom = Math.min(device?.maxZoom ?? 1, MAX_ZOOM_FACTOR);
    const cameraAnimatedProps = useAnimatedProps(() => {
        const z = Math.max(Math.min(zoom.value, maxZoom), minZoom);
        return {
            zoom: z,
        };
    }, [maxZoom, minZoom, zoom]);
    /**
     * ZOOM => FIM
     */

    //#region Callbacks
    const setIsPressingButton = useCallback(
        (_isPressingButton) => {
            isPressingButton.value = _isPressingButton;
        },
        [isPressingButton]
    );

    /**
     * CALLBACKS => INICIO
     */
    const onError = useCallback((error) => {
        console.log("onError", error);
    }, []);

    const onInitialized = useCallback(() => {
        console.log("Camera initialized!");
        setIsCameraInitialized(true);
    }, []);

    const onFlipCameraPressed = useCallback(() => {
        setCameraPosition((p) => (p === "back" ? "front" : "back"));
    }, []);

    const onFlashPressed = useCallback(() => {
        setFlash((f) => (f === "off" ? "on" : "off"));
    }, []);

    const isShowingAlert = useRef(false);
    /**
     * CALLBACKS => FIM
     */

    /**
     * PROCESSAMENTO DE MIDIA => INICIO
     */
    const onMediaCaptured = useCallback(
       async (media, type) => {
            try {
                // recupera as informacoes da foto
                let photoPath = `file://${media.path}`;
                const filename = photoPath.split("/").pop();
                // configura a nova pasta
                const newDir = FileSystem.documentDirectory + `camera-app`;
                // cria a pasta caso necessário
                await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });
                // move a foto para a nova pasta
                await FileSystem.moveAsync({ from: photoPath, to: newDir + '/' + filename });
                // atualiza o caminho da foto
                photoPath = newDir + '/' + filename;
                // redimensiona a foto, de acordo com o height e width da mesma, com objetivo de que a width fique em 800px
                const currentWidth = media.width > media.height ? media.height : media.width;
                const currentHeight = media.width > media.height ? media.width : media.height;
                let newWidth = 1000;
                let newHeight = 1000;
                if (currentWidth > currentHeight) {
                    newHeight = (currentHeight * newWidth) / currentWidth;
                } else {
                    newWidth = (currentWidth * newHeight) / currentHeight;
                }
                const response = await manipulateAsync(photoPath,
                    [{ resize: { width: newWidth, height: newHeight } }],
                    { compress: 1, format: SaveFormat.JPEG }
                );
                // verifica se ja existe uma foto no local a ser movido
                const exists = await FileSystem.getInfoAsync(photoPath);
                if (exists.exists === true) {
                    // remove a foto antiga e move a foto nova
                    await FileSystem.deleteAsync(photoPath, { idempotent: true });
                    await FileSystem.moveAsync({ from: response.uri, to: photoPath });
                } else {
                    // move a foto
                    await FileSystem.moveAsync({ from: response.uri, to: photoPath });
                }
                // verifica se a nova foto foi movida com sucesso
                const existsNew = await FileSystem.getInfoAsync(photoPath);
                if (existsNew.exists === true) {
                    setCapturedPhoto(photoPath);
                } else {
                    setCapturedPhoto(null);
                }

                await CameraRoll.save(photoPath, {
                  type: type,
                })

            } catch (error) {
                console.log(error);
            }
        },
        [navigation]
    );
    /**
     * PROCESSAMENTO DE MIDIA => FIM
     */

    /**
     * CODE SCANNER => INICIO
     */
    const onCodeScanned = useCallback((codes) => {
        console.log(`Scanned ${codes.length} codes:`, codes);
        const value = codes[0]?.value;
        if (value == null) return;
        if (isShowingAlert.current) return;
        showCodeAlert(value, () => {
            isShowingAlert.current = false;
        });
        isShowingAlert.current = true;
    }, []);
    const codeScanner = useCodeScanner({
        codeTypes: ["ean-13"],
        onCodeScanned: onCodeScanned,
    });
    /**
     * CODE SCANNER  => FIM
     */

    /**
     * DUPLO CLIQUE => INICIO
     */
    const onDoubleTap = useCallback(() => {
        onFlipCameraPressed();
    }, [onFlipCameraPressed]);
    /**
     * DUPLO CLIQUE => FIM
     */

    /**
     * EFEITO ZOOM => INICIO
     */
    const neutralZoom = device?.neutralZoom ?? 1;
    useEffect(() => {
        // Executa sempre que o valor de neutralZoomScaled muda. (redefine o zoom quando o dispositivo muda)
        zoom.value = neutralZoom;
    }, [neutralZoom, zoom]);
    /**
     * EFEITO ZOOM => FIM
     */

    /**
     * GESTO PINÇA ZOOM => INICIO
     */
    // O gestor de gestos mapeia o gesto de pinça linear (0 - 1) para uma curva exponencial,
    // já que a função de zoom de uma câmera não parece linear para o usuário.
    // (ou seja, zoom 0.1 -> 0.2 não parece igual em diferença a 0.8 -> 0.9)
    const onPinchGesture = useAnimatedGestureHandler({
        onStart: (_, context) => {
            context.startZoom = zoom.value;
        },
        onActive: (event, context) => {
            // Estamos tentando mapear o gesto de escala para um zoom linear aqui
            const startZoom = context.startZoom ?? 0;
            const scale = interpolate(
                event.scale,
                [1 - 1 / SCALE_FULL_ZOOM, 1, SCALE_FULL_ZOOM],
                [-1, 0, 1],
                Extrapolate.CLAMP
            );
            zoom.value = interpolate(
                scale,
                [-1, 0, 1],
                [minZoom, startZoom, maxZoom],
                Extrapolate.CLAMP
            );
        },
    });
    /**
     * GESTO PINÇA ZOOM => FIM
     */

    /**
     * Controle de mudanças de camera, formato e fps => INICIO
     */
    useEffect(() => {
        const f =
            format != null
                ? `(${format.photoWidth}x${format.photoHeight} photo / ${format.videoWidth}x${format.videoHeight}@${format.maxFps} video @ ${fps}fps)`
                : undefined;
        console.log(`Camera: ${device?.name} | Format: ${f}`);
    }, [device?.name, format, fps]);
    /**
     * Controle de mudanças de camera, formato e fps => FIM
     */

    /**
     * Controle de permissoes => INICIO
     */
    useEffect(() => {
        requestPermissions().then((statuses) => {
            if (statuses.camera == "granted") {
                setCameraPermission(true);
            } else {
                setCameraPermission(false);
                setModalVisible(true);
                setModalTitle("ERRO");
                setModalText(
                    "Permissão negada para a câmera, você precisa permitir para continuar!"
                );
            }

            if (statuses.photoLibrary.status == "granted") {
                setStoragePermission(true);
            } else {
                setStoragePermission(false);
                setModalVisible(true);
                setModalTitle("ERRO");
                setModalText(
                    "Permissão negada para ao armazenamento, você precisa permitir para continuar!"
                );
            }
        });
    }, []);

    const requestPermissions = async () => {
        // verifica as permissoes da camera
        const camera = await Camera.requestCameraPermission();
        // verifica as permissoes do armazenamento
        const photoLibrary = await MediaLibrary.requestPermissionsAsync();
        return { camera, photoLibrary };
    };

    // caso nao tenha a permissao de camera
    if (cameraPermission === false || cameraPermission === null) {
        return (
            <View style={[{ backgroundColor: "#FFFFFF", flex: 1 }]}>
                <ModalAPP
                    title={modalTitle}
                    text={modalText}
                    closeText={"Fechar"}
                    visible={modalVisible}
                    close={() => {
                        setModalVisible(false);
                    }}
                />
            </View>
        );
    }
    // caso nao tenha a permissao de armazenamento
    if (
        (storagePermission === false || storagePermission === null) &&
        Platform.OS != "android"
    ) {
        return (
            <View style={[{ backgroundColor: "#FFFFFF", flex: 1 }]}>
                <ModalAPP
                    title={modalTitle}
                    text={modalText}
                    closeText={"Fechar"}
                    visible={modalVisible}
                    close={() => {
                        setModalVisible(false);
                    }}
                />
            </View>
        );
    }
    /**
     * Controle de permissoes => FIM
     */

    if (device == null) return <NoCameraDeviceError />;
    return (
        <View style={styles.container}>
            {device != null && (
                <PinchGestureHandler
                    onGestureEvent={onPinchGesture}
                    enabled={isActive}
                >
                    <Reanimated.View style={StyleSheet.absoluteFill}>
                        <TapGestureHandler
                            onEnded={onDoubleTap}
                            numberOfTaps={2}
                        >
                            <ReanimatedCamera
                                ref={camera}
                                style={StyleSheet.absoluteFill}
                                device={device}
                                format={format}
                                fps={fps}
                                photoHdr={enableHdr}
                                videoHdr={enableHdr}
                                lowLightBoost={
                                    device.supportsLowLightBoost &&
                                    enableNightMode
                                }
                                isActive={isActive}
                                onInitialized={onInitialized}
                                onError={onError}
                                enableZoomGesture={false}
                                animatedProps={cameraAnimatedProps}
                                exposure={0}
                                orientation="portrait"
                                photo={true}
                                resizeMode="contain"
                                codeScanner={codeScanner}
                            />
                        </TapGestureHandler>
                    </Reanimated.View>
                </PinchGestureHandler>
            )}

            <CaptureButton
                style={styles.captureButton}
                camera={camera}
                onMediaCaptured={onMediaCaptured}
                cameraZoom={zoom}
                minZoom={minZoom}
                maxZoom={maxZoom}
                flash={supportsFlash ? flash : "off"}
                enabled={isCameraInitialized && isActive}
                setIsPressingButton={setIsPressingButton}
            />

            <StatusBarBlurBackground />

            <View style={styles.rightButtonRow}>
                <PressableOpacity
                    style={styles.button}
                    onPress={onFlipCameraPressed}
                    disabledOpacity={0.4}
                >
                    <IonIcon name="camera-reverse" color="white" size={24} />
                </PressableOpacity>
                {supportsFlash && (
                    <PressableOpacity
                        style={styles.button}
                        onPress={onFlashPressed}
                        disabledOpacity={0.4}
                    >
                        <IonIcon
                            name={flash === "on" ? "flash" : "flash-off"}
                            color="white"
                            size={24}
                        />
                    </PressableOpacity>
                )}
                {supports60Fps && (
                    <PressableOpacity
                        style={styles.button}
                        onPress={() =>
                            setTargetFps((t) => (t === 30 ? 60 : 30))
                        }
                    >
                        <Text style={styles.text}>{`${targetFps}\nFPS`}</Text>
                    </PressableOpacity>
                )}
                {supportsHdr && (
                    <PressableOpacity
                        style={styles.button}
                        onPress={() => setEnableHdr((h) => !h)}
                    >
                        <MaterialIcon
                            name={enableHdr ? "hdr" : "hdr-off"}
                            color="white"
                            size={24}
                        />
                    </PressableOpacity>
                )}
                {canToggleNightMode && (
                    <PressableOpacity
                        style={styles.button}
                        onPress={() => setEnableNightMode(!enableNightMode)}
                        disabledOpacity={0.4}
                    >
                        <IonIcon
                            name={enableNightMode ? "moon" : "moon-outline"}
                            color="white"
                            size={24}
                        />
                    </PressableOpacity>
                )}
                <PressableOpacity
                    style={styles.button}
                    onPress={() => navigation.navigate("Devices")}
                >
                    <IonIcon name="settings-outline" color="white" size={24} />
                </PressableOpacity>
            </View>

            {capturedPhoto &&
                <Modal
                    animationType="slide"
                    transparent={false}
                    visible={capturedPhoto !== null}
                >
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', margin: 20 }}>
                        <Image
                            style={{ width: '100%', height: '100%', borderRadius: 20 }}
                            source={{ uri: capturedPhoto }}
                        />
                        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', margin: 20 }}>
                            <TouchableOpacity style={{ margin: 10 }} onPress={() => {
                                setCapturedPhoto(null);
                            } }>
                                <Text>Tirar novamente</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",
    },
    captureButton: {
        position: "absolute",
        alignSelf: "center",
        bottom: SAFE_AREA_PADDING.paddingBottom,
    },
    button: {
        marginBottom: CONTENT_SPACING,
        width: CONTROL_BUTTON_SIZE,
        height: CONTROL_BUTTON_SIZE,
        borderRadius: CONTROL_BUTTON_SIZE / 2,
        backgroundColor: "rgba(140, 140, 140, 0.3)",
        justifyContent: "center",
        alignItems: "center",
    },
    rightButtonRow: {
        position: "absolute",
        right: SAFE_AREA_PADDING.paddingRight,
        top: SAFE_AREA_PADDING.paddingTop,
    },
    text: {
        color: "white",
        fontSize: 11,
        fontWeight: "bold",
        textAlign: "center",
    },
});
