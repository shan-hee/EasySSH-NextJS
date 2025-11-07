import * as $protobuf from "protobufjs";
import type Long from "long";
/** Namespace monitor. */
export namespace monitor {

    /** Properties of a SystemInfo. */
    interface ISystemInfo {

        /** SystemInfo os */
        os?: (string|null);

        /** SystemInfo hostname */
        hostname?: (string|null);

        /** SystemInfo cpuModel */
        cpuModel?: (string|null);

        /** SystemInfo arch */
        arch?: (string|null);

        /** SystemInfo loadAvg */
        loadAvg?: (string|null);

        /** SystemInfo uptimeSeconds */
        uptimeSeconds?: (number|Long|null);

        /** SystemInfo cpuCores */
        cpuCores?: (number|null);
    }

    /** Represents a SystemInfo. */
    class SystemInfo implements ISystemInfo {

        /**
         * Constructs a new SystemInfo.
         * @param [properties] Properties to set
         */
        constructor(properties?: monitor.ISystemInfo);

        /** SystemInfo os. */
        public os: string;

        /** SystemInfo hostname. */
        public hostname: string;

        /** SystemInfo cpuModel. */
        public cpuModel: string;

        /** SystemInfo arch. */
        public arch: string;

        /** SystemInfo loadAvg. */
        public loadAvg: string;

        /** SystemInfo uptimeSeconds. */
        public uptimeSeconds: (number|Long);

        /** SystemInfo cpuCores. */
        public cpuCores: number;

        /**
         * Creates a new SystemInfo instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SystemInfo instance
         */
        public static create(properties?: monitor.ISystemInfo): monitor.SystemInfo;

        /**
         * Encodes the specified SystemInfo message. Does not implicitly {@link monitor.SystemInfo.verify|verify} messages.
         * @param message SystemInfo message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: monitor.ISystemInfo, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SystemInfo message, length delimited. Does not implicitly {@link monitor.SystemInfo.verify|verify} messages.
         * @param message SystemInfo message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: monitor.ISystemInfo, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SystemInfo message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SystemInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): monitor.SystemInfo;

        /**
         * Decodes a SystemInfo message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SystemInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): monitor.SystemInfo;

        /**
         * Verifies a SystemInfo message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SystemInfo message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SystemInfo
         */
        public static fromObject(object: { [k: string]: any }): monitor.SystemInfo;

        /**
         * Creates a plain object from a SystemInfo message. Also converts values to other types if specified.
         * @param message SystemInfo
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: monitor.SystemInfo, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SystemInfo to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SystemInfo
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a CPUMetrics. */
    interface ICPUMetrics {

        /** CPUMetrics usagePercent */
        usagePercent?: (number|null);

        /** CPUMetrics coreCount */
        coreCount?: (number|null);
    }

    /** Represents a CPUMetrics. */
    class CPUMetrics implements ICPUMetrics {

        /**
         * Constructs a new CPUMetrics.
         * @param [properties] Properties to set
         */
        constructor(properties?: monitor.ICPUMetrics);

        /** CPUMetrics usagePercent. */
        public usagePercent: number;

        /** CPUMetrics coreCount. */
        public coreCount: number;

        /**
         * Creates a new CPUMetrics instance using the specified properties.
         * @param [properties] Properties to set
         * @returns CPUMetrics instance
         */
        public static create(properties?: monitor.ICPUMetrics): monitor.CPUMetrics;

        /**
         * Encodes the specified CPUMetrics message. Does not implicitly {@link monitor.CPUMetrics.verify|verify} messages.
         * @param message CPUMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: monitor.ICPUMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified CPUMetrics message, length delimited. Does not implicitly {@link monitor.CPUMetrics.verify|verify} messages.
         * @param message CPUMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: monitor.ICPUMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a CPUMetrics message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns CPUMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): monitor.CPUMetrics;

        /**
         * Decodes a CPUMetrics message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns CPUMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): monitor.CPUMetrics;

        /**
         * Verifies a CPUMetrics message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a CPUMetrics message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns CPUMetrics
         */
        public static fromObject(object: { [k: string]: any }): monitor.CPUMetrics;

        /**
         * Creates a plain object from a CPUMetrics message. Also converts values to other types if specified.
         * @param message CPUMetrics
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: monitor.CPUMetrics, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this CPUMetrics to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for CPUMetrics
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MemoryMetrics. */
    interface IMemoryMetrics {

        /** MemoryMetrics ramUsedBytes */
        ramUsedBytes?: (number|Long|null);

        /** MemoryMetrics ramTotalBytes */
        ramTotalBytes?: (number|Long|null);

        /** MemoryMetrics swapUsedBytes */
        swapUsedBytes?: (number|Long|null);

        /** MemoryMetrics swapTotalBytes */
        swapTotalBytes?: (number|Long|null);
    }

    /** Represents a MemoryMetrics. */
    class MemoryMetrics implements IMemoryMetrics {

        /**
         * Constructs a new MemoryMetrics.
         * @param [properties] Properties to set
         */
        constructor(properties?: monitor.IMemoryMetrics);

        /** MemoryMetrics ramUsedBytes. */
        public ramUsedBytes: (number|Long);

        /** MemoryMetrics ramTotalBytes. */
        public ramTotalBytes: (number|Long);

        /** MemoryMetrics swapUsedBytes. */
        public swapUsedBytes: (number|Long);

        /** MemoryMetrics swapTotalBytes. */
        public swapTotalBytes: (number|Long);

        /**
         * Creates a new MemoryMetrics instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MemoryMetrics instance
         */
        public static create(properties?: monitor.IMemoryMetrics): monitor.MemoryMetrics;

        /**
         * Encodes the specified MemoryMetrics message. Does not implicitly {@link monitor.MemoryMetrics.verify|verify} messages.
         * @param message MemoryMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: monitor.IMemoryMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MemoryMetrics message, length delimited. Does not implicitly {@link monitor.MemoryMetrics.verify|verify} messages.
         * @param message MemoryMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: monitor.IMemoryMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MemoryMetrics message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MemoryMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): monitor.MemoryMetrics;

        /**
         * Decodes a MemoryMetrics message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MemoryMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): monitor.MemoryMetrics;

        /**
         * Verifies a MemoryMetrics message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MemoryMetrics message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MemoryMetrics
         */
        public static fromObject(object: { [k: string]: any }): monitor.MemoryMetrics;

        /**
         * Creates a plain object from a MemoryMetrics message. Also converts values to other types if specified.
         * @param message MemoryMetrics
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: monitor.MemoryMetrics, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MemoryMetrics to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MemoryMetrics
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a NetworkMetrics. */
    interface INetworkMetrics {

        /** NetworkMetrics bytesRecvPerSec */
        bytesRecvPerSec?: (number|Long|null);

        /** NetworkMetrics bytesSentPerSec */
        bytesSentPerSec?: (number|Long|null);
    }

    /** Represents a NetworkMetrics. */
    class NetworkMetrics implements INetworkMetrics {

        /**
         * Constructs a new NetworkMetrics.
         * @param [properties] Properties to set
         */
        constructor(properties?: monitor.INetworkMetrics);

        /** NetworkMetrics bytesRecvPerSec. */
        public bytesRecvPerSec: (number|Long);

        /** NetworkMetrics bytesSentPerSec. */
        public bytesSentPerSec: (number|Long);

        /**
         * Creates a new NetworkMetrics instance using the specified properties.
         * @param [properties] Properties to set
         * @returns NetworkMetrics instance
         */
        public static create(properties?: monitor.INetworkMetrics): monitor.NetworkMetrics;

        /**
         * Encodes the specified NetworkMetrics message. Does not implicitly {@link monitor.NetworkMetrics.verify|verify} messages.
         * @param message NetworkMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: monitor.INetworkMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified NetworkMetrics message, length delimited. Does not implicitly {@link monitor.NetworkMetrics.verify|verify} messages.
         * @param message NetworkMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: monitor.INetworkMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a NetworkMetrics message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns NetworkMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): monitor.NetworkMetrics;

        /**
         * Decodes a NetworkMetrics message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns NetworkMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): monitor.NetworkMetrics;

        /**
         * Verifies a NetworkMetrics message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a NetworkMetrics message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns NetworkMetrics
         */
        public static fromObject(object: { [k: string]: any }): monitor.NetworkMetrics;

        /**
         * Creates a plain object from a NetworkMetrics message. Also converts values to other types if specified.
         * @param message NetworkMetrics
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: monitor.NetworkMetrics, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this NetworkMetrics to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for NetworkMetrics
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a DiskMetrics. */
    interface IDiskMetrics {

        /** DiskMetrics mountPoint */
        mountPoint?: (string|null);

        /** DiskMetrics usedBytes */
        usedBytes?: (number|Long|null);

        /** DiskMetrics totalBytes */
        totalBytes?: (number|Long|null);
    }

    /** Represents a DiskMetrics. */
    class DiskMetrics implements IDiskMetrics {

        /**
         * Constructs a new DiskMetrics.
         * @param [properties] Properties to set
         */
        constructor(properties?: monitor.IDiskMetrics);

        /** DiskMetrics mountPoint. */
        public mountPoint: string;

        /** DiskMetrics usedBytes. */
        public usedBytes: (number|Long);

        /** DiskMetrics totalBytes. */
        public totalBytes: (number|Long);

        /**
         * Creates a new DiskMetrics instance using the specified properties.
         * @param [properties] Properties to set
         * @returns DiskMetrics instance
         */
        public static create(properties?: monitor.IDiskMetrics): monitor.DiskMetrics;

        /**
         * Encodes the specified DiskMetrics message. Does not implicitly {@link monitor.DiskMetrics.verify|verify} messages.
         * @param message DiskMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: monitor.IDiskMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified DiskMetrics message, length delimited. Does not implicitly {@link monitor.DiskMetrics.verify|verify} messages.
         * @param message DiskMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: monitor.IDiskMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a DiskMetrics message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns DiskMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): monitor.DiskMetrics;

        /**
         * Decodes a DiskMetrics message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns DiskMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): monitor.DiskMetrics;

        /**
         * Verifies a DiskMetrics message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a DiskMetrics message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns DiskMetrics
         */
        public static fromObject(object: { [k: string]: any }): monitor.DiskMetrics;

        /**
         * Creates a plain object from a DiskMetrics message. Also converts values to other types if specified.
         * @param message DiskMetrics
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: monitor.DiskMetrics, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this DiskMetrics to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for DiskMetrics
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SystemMetrics. */
    interface ISystemMetrics {

        /** SystemMetrics systemInfo */
        systemInfo?: (monitor.ISystemInfo|null);

        /** SystemMetrics cpu */
        cpu?: (monitor.ICPUMetrics|null);

        /** SystemMetrics memory */
        memory?: (monitor.IMemoryMetrics|null);

        /** SystemMetrics network */
        network?: (monitor.INetworkMetrics|null);

        /** SystemMetrics disks */
        disks?: (monitor.IDiskMetrics[]|null);

        /** SystemMetrics timestamp */
        timestamp?: (number|Long|null);

        /** SystemMetrics diskTotalPercent */
        diskTotalPercent?: (number|null);

        /** SystemMetrics sshLatencyMs */
        sshLatencyMs?: (number|Long|null);
    }

    /** Represents a SystemMetrics. */
    class SystemMetrics implements ISystemMetrics {

        /**
         * Constructs a new SystemMetrics.
         * @param [properties] Properties to set
         */
        constructor(properties?: monitor.ISystemMetrics);

        /** SystemMetrics systemInfo. */
        public systemInfo?: (monitor.ISystemInfo|null);

        /** SystemMetrics cpu. */
        public cpu?: (monitor.ICPUMetrics|null);

        /** SystemMetrics memory. */
        public memory?: (monitor.IMemoryMetrics|null);

        /** SystemMetrics network. */
        public network?: (monitor.INetworkMetrics|null);

        /** SystemMetrics disks. */
        public disks: monitor.IDiskMetrics[];

        /** SystemMetrics timestamp. */
        public timestamp: (number|Long);

        /** SystemMetrics diskTotalPercent. */
        public diskTotalPercent: number;

        /** SystemMetrics sshLatencyMs. */
        public sshLatencyMs: (number|Long);

        /**
         * Creates a new SystemMetrics instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SystemMetrics instance
         */
        public static create(properties?: monitor.ISystemMetrics): monitor.SystemMetrics;

        /**
         * Encodes the specified SystemMetrics message. Does not implicitly {@link monitor.SystemMetrics.verify|verify} messages.
         * @param message SystemMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: monitor.ISystemMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SystemMetrics message, length delimited. Does not implicitly {@link monitor.SystemMetrics.verify|verify} messages.
         * @param message SystemMetrics message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: monitor.ISystemMetrics, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SystemMetrics message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SystemMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): monitor.SystemMetrics;

        /**
         * Decodes a SystemMetrics message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SystemMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): monitor.SystemMetrics;

        /**
         * Verifies a SystemMetrics message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SystemMetrics message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SystemMetrics
         */
        public static fromObject(object: { [k: string]: any }): monitor.SystemMetrics;

        /**
         * Creates a plain object from a SystemMetrics message. Also converts values to other types if specified.
         * @param message SystemMetrics
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: monitor.SystemMetrics, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SystemMetrics to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SystemMetrics
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }
}
