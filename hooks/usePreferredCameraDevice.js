import { useMMKVString } from "react-native-mmkv";
import { useCallback, useMemo } from "react";
import { useCameraDevices } from "react-native-vision-camera";

export function usePreferredCameraDevice() {
    const [preferredDeviceId, setPreferredDeviceId] = useMMKVString(
        "camera.preferredDeviceId"
    );

    const set = useCallback(
        (device) => {
            setPreferredDeviceId(device.id);
        },
        [setPreferredDeviceId]
    );

    const devices = useCameraDevices();
    const device = useMemo(
        () => devices.find((d) => d.id === preferredDeviceId),
        [devices, preferredDeviceId]
    );

    return [device, set];
}
