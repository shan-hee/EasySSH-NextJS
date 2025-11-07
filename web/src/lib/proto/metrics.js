 
"use strict";

import * as $protobuf from "protobufjs/minimal";

// Common aliases
var $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
var $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

$root.monitor = (function() {

    /**
     * Namespace monitor.
     * @exports monitor
     * @namespace
     */
    var monitor = {};

    monitor.SystemInfo = (function() {

        /**
         * Properties of a SystemInfo.
         * @memberof monitor
         * @interface ISystemInfo
         * @property {string|null} [os] SystemInfo os
         * @property {string|null} [hostname] SystemInfo hostname
         * @property {string|null} [cpuModel] SystemInfo cpuModel
         * @property {string|null} [arch] SystemInfo arch
         * @property {string|null} [loadAvg] SystemInfo loadAvg
         * @property {number|Long|null} [uptimeSeconds] SystemInfo uptimeSeconds
         * @property {number|null} [cpuCores] SystemInfo cpuCores
         */

        /**
         * Constructs a new SystemInfo.
         * @memberof monitor
         * @classdesc Represents a SystemInfo.
         * @implements ISystemInfo
         * @constructor
         * @param {monitor.ISystemInfo=} [properties] Properties to set
         */
        function SystemInfo(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SystemInfo os.
         * @member {string} os
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.os = "";

        /**
         * SystemInfo hostname.
         * @member {string} hostname
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.hostname = "";

        /**
         * SystemInfo cpuModel.
         * @member {string} cpuModel
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.cpuModel = "";

        /**
         * SystemInfo arch.
         * @member {string} arch
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.arch = "";

        /**
         * SystemInfo loadAvg.
         * @member {string} loadAvg
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.loadAvg = "";

        /**
         * SystemInfo uptimeSeconds.
         * @member {number|Long} uptimeSeconds
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.uptimeSeconds = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * SystemInfo cpuCores.
         * @member {number} cpuCores
         * @memberof monitor.SystemInfo
         * @instance
         */
        SystemInfo.prototype.cpuCores = 0;

        /**
         * Creates a new SystemInfo instance using the specified properties.
         * @function create
         * @memberof monitor.SystemInfo
         * @static
         * @param {monitor.ISystemInfo=} [properties] Properties to set
         * @returns {monitor.SystemInfo} SystemInfo instance
         */
        SystemInfo.create = function create(properties) {
            return new SystemInfo(properties);
        };

        /**
         * Encodes the specified SystemInfo message. Does not implicitly {@link monitor.SystemInfo.verify|verify} messages.
         * @function encode
         * @memberof monitor.SystemInfo
         * @static
         * @param {monitor.ISystemInfo} message SystemInfo message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SystemInfo.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.os != null && Object.hasOwnProperty.call(message, "os"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.os);
            if (message.hostname != null && Object.hasOwnProperty.call(message, "hostname"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.hostname);
            if (message.cpuModel != null && Object.hasOwnProperty.call(message, "cpuModel"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.cpuModel);
            if (message.arch != null && Object.hasOwnProperty.call(message, "arch"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.arch);
            if (message.loadAvg != null && Object.hasOwnProperty.call(message, "loadAvg"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.loadAvg);
            if (message.uptimeSeconds != null && Object.hasOwnProperty.call(message, "uptimeSeconds"))
                writer.uint32(/* id 6, wireType 0 =*/48).uint64(message.uptimeSeconds);
            if (message.cpuCores != null && Object.hasOwnProperty.call(message, "cpuCores"))
                writer.uint32(/* id 7, wireType 0 =*/56).uint32(message.cpuCores);
            return writer;
        };

        /**
         * Encodes the specified SystemInfo message, length delimited. Does not implicitly {@link monitor.SystemInfo.verify|verify} messages.
         * @function encodeDelimited
         * @memberof monitor.SystemInfo
         * @static
         * @param {monitor.ISystemInfo} message SystemInfo message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SystemInfo.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SystemInfo message from the specified reader or buffer.
         * @function decode
         * @memberof monitor.SystemInfo
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {monitor.SystemInfo} SystemInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SystemInfo.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.monitor.SystemInfo();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.os = reader.string();
                        break;
                    }
                case 2: {
                        message.hostname = reader.string();
                        break;
                    }
                case 3: {
                        message.cpuModel = reader.string();
                        break;
                    }
                case 4: {
                        message.arch = reader.string();
                        break;
                    }
                case 5: {
                        message.loadAvg = reader.string();
                        break;
                    }
                case 6: {
                        message.uptimeSeconds = reader.uint64();
                        break;
                    }
                case 7: {
                        message.cpuCores = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SystemInfo message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof monitor.SystemInfo
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {monitor.SystemInfo} SystemInfo
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SystemInfo.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SystemInfo message.
         * @function verify
         * @memberof monitor.SystemInfo
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SystemInfo.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.os != null && message.hasOwnProperty("os"))
                if (!$util.isString(message.os))
                    return "os: string expected";
            if (message.hostname != null && message.hasOwnProperty("hostname"))
                if (!$util.isString(message.hostname))
                    return "hostname: string expected";
            if (message.cpuModel != null && message.hasOwnProperty("cpuModel"))
                if (!$util.isString(message.cpuModel))
                    return "cpuModel: string expected";
            if (message.arch != null && message.hasOwnProperty("arch"))
                if (!$util.isString(message.arch))
                    return "arch: string expected";
            if (message.loadAvg != null && message.hasOwnProperty("loadAvg"))
                if (!$util.isString(message.loadAvg))
                    return "loadAvg: string expected";
            if (message.uptimeSeconds != null && message.hasOwnProperty("uptimeSeconds"))
                if (!$util.isInteger(message.uptimeSeconds) && !(message.uptimeSeconds && $util.isInteger(message.uptimeSeconds.low) && $util.isInteger(message.uptimeSeconds.high)))
                    return "uptimeSeconds: integer|Long expected";
            if (message.cpuCores != null && message.hasOwnProperty("cpuCores"))
                if (!$util.isInteger(message.cpuCores))
                    return "cpuCores: integer expected";
            return null;
        };

        /**
         * Creates a SystemInfo message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof monitor.SystemInfo
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {monitor.SystemInfo} SystemInfo
         */
        SystemInfo.fromObject = function fromObject(object) {
            if (object instanceof $root.monitor.SystemInfo)
                return object;
            var message = new $root.monitor.SystemInfo();
            if (object.os != null)
                message.os = String(object.os);
            if (object.hostname != null)
                message.hostname = String(object.hostname);
            if (object.cpuModel != null)
                message.cpuModel = String(object.cpuModel);
            if (object.arch != null)
                message.arch = String(object.arch);
            if (object.loadAvg != null)
                message.loadAvg = String(object.loadAvg);
            if (object.uptimeSeconds != null)
                if ($util.Long)
                    (message.uptimeSeconds = $util.Long.fromValue(object.uptimeSeconds)).unsigned = true;
                else if (typeof object.uptimeSeconds === "string")
                    message.uptimeSeconds = parseInt(object.uptimeSeconds, 10);
                else if (typeof object.uptimeSeconds === "number")
                    message.uptimeSeconds = object.uptimeSeconds;
                else if (typeof object.uptimeSeconds === "object")
                    message.uptimeSeconds = new $util.LongBits(object.uptimeSeconds.low >>> 0, object.uptimeSeconds.high >>> 0).toNumber(true);
            if (object.cpuCores != null)
                message.cpuCores = object.cpuCores >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a SystemInfo message. Also converts values to other types if specified.
         * @function toObject
         * @memberof monitor.SystemInfo
         * @static
         * @param {monitor.SystemInfo} message SystemInfo
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SystemInfo.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.os = "";
                object.hostname = "";
                object.cpuModel = "";
                object.arch = "";
                object.loadAvg = "";
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.uptimeSeconds = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.uptimeSeconds = options.longs === String ? "0" : 0;
                object.cpuCores = 0;
            }
            if (message.os != null && message.hasOwnProperty("os"))
                object.os = message.os;
            if (message.hostname != null && message.hasOwnProperty("hostname"))
                object.hostname = message.hostname;
            if (message.cpuModel != null && message.hasOwnProperty("cpuModel"))
                object.cpuModel = message.cpuModel;
            if (message.arch != null && message.hasOwnProperty("arch"))
                object.arch = message.arch;
            if (message.loadAvg != null && message.hasOwnProperty("loadAvg"))
                object.loadAvg = message.loadAvg;
            if (message.uptimeSeconds != null && message.hasOwnProperty("uptimeSeconds"))
                if (typeof message.uptimeSeconds === "number")
                    object.uptimeSeconds = options.longs === String ? String(message.uptimeSeconds) : message.uptimeSeconds;
                else
                    object.uptimeSeconds = options.longs === String ? $util.Long.prototype.toString.call(message.uptimeSeconds) : options.longs === Number ? new $util.LongBits(message.uptimeSeconds.low >>> 0, message.uptimeSeconds.high >>> 0).toNumber(true) : message.uptimeSeconds;
            if (message.cpuCores != null && message.hasOwnProperty("cpuCores"))
                object.cpuCores = message.cpuCores;
            return object;
        };

        /**
         * Converts this SystemInfo to JSON.
         * @function toJSON
         * @memberof monitor.SystemInfo
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SystemInfo.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SystemInfo
         * @function getTypeUrl
         * @memberof monitor.SystemInfo
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SystemInfo.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/monitor.SystemInfo";
        };

        return SystemInfo;
    })();

    monitor.CPUMetrics = (function() {

        /**
         * Properties of a CPUMetrics.
         * @memberof monitor
         * @interface ICPUMetrics
         * @property {number|null} [usagePercent] CPUMetrics usagePercent
         * @property {number|null} [coreCount] CPUMetrics coreCount
         */

        /**
         * Constructs a new CPUMetrics.
         * @memberof monitor
         * @classdesc Represents a CPUMetrics.
         * @implements ICPUMetrics
         * @constructor
         * @param {monitor.ICPUMetrics=} [properties] Properties to set
         */
        function CPUMetrics(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * CPUMetrics usagePercent.
         * @member {number} usagePercent
         * @memberof monitor.CPUMetrics
         * @instance
         */
        CPUMetrics.prototype.usagePercent = 0;

        /**
         * CPUMetrics coreCount.
         * @member {number} coreCount
         * @memberof monitor.CPUMetrics
         * @instance
         */
        CPUMetrics.prototype.coreCount = 0;

        /**
         * Creates a new CPUMetrics instance using the specified properties.
         * @function create
         * @memberof monitor.CPUMetrics
         * @static
         * @param {monitor.ICPUMetrics=} [properties] Properties to set
         * @returns {monitor.CPUMetrics} CPUMetrics instance
         */
        CPUMetrics.create = function create(properties) {
            return new CPUMetrics(properties);
        };

        /**
         * Encodes the specified CPUMetrics message. Does not implicitly {@link monitor.CPUMetrics.verify|verify} messages.
         * @function encode
         * @memberof monitor.CPUMetrics
         * @static
         * @param {monitor.ICPUMetrics} message CPUMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CPUMetrics.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.usagePercent != null && Object.hasOwnProperty.call(message, "usagePercent"))
                writer.uint32(/* id 1, wireType 1 =*/9).double(message.usagePercent);
            if (message.coreCount != null && Object.hasOwnProperty.call(message, "coreCount"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint32(message.coreCount);
            return writer;
        };

        /**
         * Encodes the specified CPUMetrics message, length delimited. Does not implicitly {@link monitor.CPUMetrics.verify|verify} messages.
         * @function encodeDelimited
         * @memberof monitor.CPUMetrics
         * @static
         * @param {monitor.ICPUMetrics} message CPUMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        CPUMetrics.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a CPUMetrics message from the specified reader or buffer.
         * @function decode
         * @memberof monitor.CPUMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {monitor.CPUMetrics} CPUMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CPUMetrics.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.monitor.CPUMetrics();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.usagePercent = reader.double();
                        break;
                    }
                case 2: {
                        message.coreCount = reader.uint32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a CPUMetrics message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof monitor.CPUMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {monitor.CPUMetrics} CPUMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        CPUMetrics.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a CPUMetrics message.
         * @function verify
         * @memberof monitor.CPUMetrics
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        CPUMetrics.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.usagePercent != null && message.hasOwnProperty("usagePercent"))
                if (typeof message.usagePercent !== "number")
                    return "usagePercent: number expected";
            if (message.coreCount != null && message.hasOwnProperty("coreCount"))
                if (!$util.isInteger(message.coreCount))
                    return "coreCount: integer expected";
            return null;
        };

        /**
         * Creates a CPUMetrics message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof monitor.CPUMetrics
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {monitor.CPUMetrics} CPUMetrics
         */
        CPUMetrics.fromObject = function fromObject(object) {
            if (object instanceof $root.monitor.CPUMetrics)
                return object;
            var message = new $root.monitor.CPUMetrics();
            if (object.usagePercent != null)
                message.usagePercent = Number(object.usagePercent);
            if (object.coreCount != null)
                message.coreCount = object.coreCount >>> 0;
            return message;
        };

        /**
         * Creates a plain object from a CPUMetrics message. Also converts values to other types if specified.
         * @function toObject
         * @memberof monitor.CPUMetrics
         * @static
         * @param {monitor.CPUMetrics} message CPUMetrics
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        CPUMetrics.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.usagePercent = 0;
                object.coreCount = 0;
            }
            if (message.usagePercent != null && message.hasOwnProperty("usagePercent"))
                object.usagePercent = options.json && !isFinite(message.usagePercent) ? String(message.usagePercent) : message.usagePercent;
            if (message.coreCount != null && message.hasOwnProperty("coreCount"))
                object.coreCount = message.coreCount;
            return object;
        };

        /**
         * Converts this CPUMetrics to JSON.
         * @function toJSON
         * @memberof monitor.CPUMetrics
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        CPUMetrics.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for CPUMetrics
         * @function getTypeUrl
         * @memberof monitor.CPUMetrics
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        CPUMetrics.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/monitor.CPUMetrics";
        };

        return CPUMetrics;
    })();

    monitor.MemoryMetrics = (function() {

        /**
         * Properties of a MemoryMetrics.
         * @memberof monitor
         * @interface IMemoryMetrics
         * @property {number|Long|null} [ramUsedBytes] MemoryMetrics ramUsedBytes
         * @property {number|Long|null} [ramTotalBytes] MemoryMetrics ramTotalBytes
         * @property {number|Long|null} [swapUsedBytes] MemoryMetrics swapUsedBytes
         * @property {number|Long|null} [swapTotalBytes] MemoryMetrics swapTotalBytes
         */

        /**
         * Constructs a new MemoryMetrics.
         * @memberof monitor
         * @classdesc Represents a MemoryMetrics.
         * @implements IMemoryMetrics
         * @constructor
         * @param {monitor.IMemoryMetrics=} [properties] Properties to set
         */
        function MemoryMetrics(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MemoryMetrics ramUsedBytes.
         * @member {number|Long} ramUsedBytes
         * @memberof monitor.MemoryMetrics
         * @instance
         */
        MemoryMetrics.prototype.ramUsedBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * MemoryMetrics ramTotalBytes.
         * @member {number|Long} ramTotalBytes
         * @memberof monitor.MemoryMetrics
         * @instance
         */
        MemoryMetrics.prototype.ramTotalBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * MemoryMetrics swapUsedBytes.
         * @member {number|Long} swapUsedBytes
         * @memberof monitor.MemoryMetrics
         * @instance
         */
        MemoryMetrics.prototype.swapUsedBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * MemoryMetrics swapTotalBytes.
         * @member {number|Long} swapTotalBytes
         * @memberof monitor.MemoryMetrics
         * @instance
         */
        MemoryMetrics.prototype.swapTotalBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new MemoryMetrics instance using the specified properties.
         * @function create
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {monitor.IMemoryMetrics=} [properties] Properties to set
         * @returns {monitor.MemoryMetrics} MemoryMetrics instance
         */
        MemoryMetrics.create = function create(properties) {
            return new MemoryMetrics(properties);
        };

        /**
         * Encodes the specified MemoryMetrics message. Does not implicitly {@link monitor.MemoryMetrics.verify|verify} messages.
         * @function encode
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {monitor.IMemoryMetrics} message MemoryMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MemoryMetrics.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.ramUsedBytes != null && Object.hasOwnProperty.call(message, "ramUsedBytes"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.ramUsedBytes);
            if (message.ramTotalBytes != null && Object.hasOwnProperty.call(message, "ramTotalBytes"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.ramTotalBytes);
            if (message.swapUsedBytes != null && Object.hasOwnProperty.call(message, "swapUsedBytes"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.swapUsedBytes);
            if (message.swapTotalBytes != null && Object.hasOwnProperty.call(message, "swapTotalBytes"))
                writer.uint32(/* id 4, wireType 0 =*/32).uint64(message.swapTotalBytes);
            return writer;
        };

        /**
         * Encodes the specified MemoryMetrics message, length delimited. Does not implicitly {@link monitor.MemoryMetrics.verify|verify} messages.
         * @function encodeDelimited
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {monitor.IMemoryMetrics} message MemoryMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MemoryMetrics.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a MemoryMetrics message from the specified reader or buffer.
         * @function decode
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {monitor.MemoryMetrics} MemoryMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MemoryMetrics.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.monitor.MemoryMetrics();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.ramUsedBytes = reader.uint64();
                        break;
                    }
                case 2: {
                        message.ramTotalBytes = reader.uint64();
                        break;
                    }
                case 3: {
                        message.swapUsedBytes = reader.uint64();
                        break;
                    }
                case 4: {
                        message.swapTotalBytes = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a MemoryMetrics message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {monitor.MemoryMetrics} MemoryMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MemoryMetrics.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MemoryMetrics message.
         * @function verify
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MemoryMetrics.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.ramUsedBytes != null && message.hasOwnProperty("ramUsedBytes"))
                if (!$util.isInteger(message.ramUsedBytes) && !(message.ramUsedBytes && $util.isInteger(message.ramUsedBytes.low) && $util.isInteger(message.ramUsedBytes.high)))
                    return "ramUsedBytes: integer|Long expected";
            if (message.ramTotalBytes != null && message.hasOwnProperty("ramTotalBytes"))
                if (!$util.isInteger(message.ramTotalBytes) && !(message.ramTotalBytes && $util.isInteger(message.ramTotalBytes.low) && $util.isInteger(message.ramTotalBytes.high)))
                    return "ramTotalBytes: integer|Long expected";
            if (message.swapUsedBytes != null && message.hasOwnProperty("swapUsedBytes"))
                if (!$util.isInteger(message.swapUsedBytes) && !(message.swapUsedBytes && $util.isInteger(message.swapUsedBytes.low) && $util.isInteger(message.swapUsedBytes.high)))
                    return "swapUsedBytes: integer|Long expected";
            if (message.swapTotalBytes != null && message.hasOwnProperty("swapTotalBytes"))
                if (!$util.isInteger(message.swapTotalBytes) && !(message.swapTotalBytes && $util.isInteger(message.swapTotalBytes.low) && $util.isInteger(message.swapTotalBytes.high)))
                    return "swapTotalBytes: integer|Long expected";
            return null;
        };

        /**
         * Creates a MemoryMetrics message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {monitor.MemoryMetrics} MemoryMetrics
         */
        MemoryMetrics.fromObject = function fromObject(object) {
            if (object instanceof $root.monitor.MemoryMetrics)
                return object;
            var message = new $root.monitor.MemoryMetrics();
            if (object.ramUsedBytes != null)
                if ($util.Long)
                    (message.ramUsedBytes = $util.Long.fromValue(object.ramUsedBytes)).unsigned = true;
                else if (typeof object.ramUsedBytes === "string")
                    message.ramUsedBytes = parseInt(object.ramUsedBytes, 10);
                else if (typeof object.ramUsedBytes === "number")
                    message.ramUsedBytes = object.ramUsedBytes;
                else if (typeof object.ramUsedBytes === "object")
                    message.ramUsedBytes = new $util.LongBits(object.ramUsedBytes.low >>> 0, object.ramUsedBytes.high >>> 0).toNumber(true);
            if (object.ramTotalBytes != null)
                if ($util.Long)
                    (message.ramTotalBytes = $util.Long.fromValue(object.ramTotalBytes)).unsigned = true;
                else if (typeof object.ramTotalBytes === "string")
                    message.ramTotalBytes = parseInt(object.ramTotalBytes, 10);
                else if (typeof object.ramTotalBytes === "number")
                    message.ramTotalBytes = object.ramTotalBytes;
                else if (typeof object.ramTotalBytes === "object")
                    message.ramTotalBytes = new $util.LongBits(object.ramTotalBytes.low >>> 0, object.ramTotalBytes.high >>> 0).toNumber(true);
            if (object.swapUsedBytes != null)
                if ($util.Long)
                    (message.swapUsedBytes = $util.Long.fromValue(object.swapUsedBytes)).unsigned = true;
                else if (typeof object.swapUsedBytes === "string")
                    message.swapUsedBytes = parseInt(object.swapUsedBytes, 10);
                else if (typeof object.swapUsedBytes === "number")
                    message.swapUsedBytes = object.swapUsedBytes;
                else if (typeof object.swapUsedBytes === "object")
                    message.swapUsedBytes = new $util.LongBits(object.swapUsedBytes.low >>> 0, object.swapUsedBytes.high >>> 0).toNumber(true);
            if (object.swapTotalBytes != null)
                if ($util.Long)
                    (message.swapTotalBytes = $util.Long.fromValue(object.swapTotalBytes)).unsigned = true;
                else if (typeof object.swapTotalBytes === "string")
                    message.swapTotalBytes = parseInt(object.swapTotalBytes, 10);
                else if (typeof object.swapTotalBytes === "number")
                    message.swapTotalBytes = object.swapTotalBytes;
                else if (typeof object.swapTotalBytes === "object")
                    message.swapTotalBytes = new $util.LongBits(object.swapTotalBytes.low >>> 0, object.swapTotalBytes.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a MemoryMetrics message. Also converts values to other types if specified.
         * @function toObject
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {monitor.MemoryMetrics} message MemoryMetrics
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MemoryMetrics.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.ramUsedBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.ramUsedBytes = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.ramTotalBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.ramTotalBytes = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.swapUsedBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.swapUsedBytes = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.swapTotalBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.swapTotalBytes = options.longs === String ? "0" : 0;
            }
            if (message.ramUsedBytes != null && message.hasOwnProperty("ramUsedBytes"))
                if (typeof message.ramUsedBytes === "number")
                    object.ramUsedBytes = options.longs === String ? String(message.ramUsedBytes) : message.ramUsedBytes;
                else
                    object.ramUsedBytes = options.longs === String ? $util.Long.prototype.toString.call(message.ramUsedBytes) : options.longs === Number ? new $util.LongBits(message.ramUsedBytes.low >>> 0, message.ramUsedBytes.high >>> 0).toNumber(true) : message.ramUsedBytes;
            if (message.ramTotalBytes != null && message.hasOwnProperty("ramTotalBytes"))
                if (typeof message.ramTotalBytes === "number")
                    object.ramTotalBytes = options.longs === String ? String(message.ramTotalBytes) : message.ramTotalBytes;
                else
                    object.ramTotalBytes = options.longs === String ? $util.Long.prototype.toString.call(message.ramTotalBytes) : options.longs === Number ? new $util.LongBits(message.ramTotalBytes.low >>> 0, message.ramTotalBytes.high >>> 0).toNumber(true) : message.ramTotalBytes;
            if (message.swapUsedBytes != null && message.hasOwnProperty("swapUsedBytes"))
                if (typeof message.swapUsedBytes === "number")
                    object.swapUsedBytes = options.longs === String ? String(message.swapUsedBytes) : message.swapUsedBytes;
                else
                    object.swapUsedBytes = options.longs === String ? $util.Long.prototype.toString.call(message.swapUsedBytes) : options.longs === Number ? new $util.LongBits(message.swapUsedBytes.low >>> 0, message.swapUsedBytes.high >>> 0).toNumber(true) : message.swapUsedBytes;
            if (message.swapTotalBytes != null && message.hasOwnProperty("swapTotalBytes"))
                if (typeof message.swapTotalBytes === "number")
                    object.swapTotalBytes = options.longs === String ? String(message.swapTotalBytes) : message.swapTotalBytes;
                else
                    object.swapTotalBytes = options.longs === String ? $util.Long.prototype.toString.call(message.swapTotalBytes) : options.longs === Number ? new $util.LongBits(message.swapTotalBytes.low >>> 0, message.swapTotalBytes.high >>> 0).toNumber(true) : message.swapTotalBytes;
            return object;
        };

        /**
         * Converts this MemoryMetrics to JSON.
         * @function toJSON
         * @memberof monitor.MemoryMetrics
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MemoryMetrics.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for MemoryMetrics
         * @function getTypeUrl
         * @memberof monitor.MemoryMetrics
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        MemoryMetrics.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/monitor.MemoryMetrics";
        };

        return MemoryMetrics;
    })();

    monitor.NetworkMetrics = (function() {

        /**
         * Properties of a NetworkMetrics.
         * @memberof monitor
         * @interface INetworkMetrics
         * @property {number|Long|null} [bytesRecvPerSec] NetworkMetrics bytesRecvPerSec
         * @property {number|Long|null} [bytesSentPerSec] NetworkMetrics bytesSentPerSec
         */

        /**
         * Constructs a new NetworkMetrics.
         * @memberof monitor
         * @classdesc Represents a NetworkMetrics.
         * @implements INetworkMetrics
         * @constructor
         * @param {monitor.INetworkMetrics=} [properties] Properties to set
         */
        function NetworkMetrics(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * NetworkMetrics bytesRecvPerSec.
         * @member {number|Long} bytesRecvPerSec
         * @memberof monitor.NetworkMetrics
         * @instance
         */
        NetworkMetrics.prototype.bytesRecvPerSec = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * NetworkMetrics bytesSentPerSec.
         * @member {number|Long} bytesSentPerSec
         * @memberof monitor.NetworkMetrics
         * @instance
         */
        NetworkMetrics.prototype.bytesSentPerSec = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new NetworkMetrics instance using the specified properties.
         * @function create
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {monitor.INetworkMetrics=} [properties] Properties to set
         * @returns {monitor.NetworkMetrics} NetworkMetrics instance
         */
        NetworkMetrics.create = function create(properties) {
            return new NetworkMetrics(properties);
        };

        /**
         * Encodes the specified NetworkMetrics message. Does not implicitly {@link monitor.NetworkMetrics.verify|verify} messages.
         * @function encode
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {monitor.INetworkMetrics} message NetworkMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NetworkMetrics.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.bytesRecvPerSec != null && Object.hasOwnProperty.call(message, "bytesRecvPerSec"))
                writer.uint32(/* id 1, wireType 0 =*/8).uint64(message.bytesRecvPerSec);
            if (message.bytesSentPerSec != null && Object.hasOwnProperty.call(message, "bytesSentPerSec"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.bytesSentPerSec);
            return writer;
        };

        /**
         * Encodes the specified NetworkMetrics message, length delimited. Does not implicitly {@link monitor.NetworkMetrics.verify|verify} messages.
         * @function encodeDelimited
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {monitor.INetworkMetrics} message NetworkMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        NetworkMetrics.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a NetworkMetrics message from the specified reader or buffer.
         * @function decode
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {monitor.NetworkMetrics} NetworkMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NetworkMetrics.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.monitor.NetworkMetrics();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.bytesRecvPerSec = reader.uint64();
                        break;
                    }
                case 2: {
                        message.bytesSentPerSec = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a NetworkMetrics message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {monitor.NetworkMetrics} NetworkMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        NetworkMetrics.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a NetworkMetrics message.
         * @function verify
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        NetworkMetrics.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.bytesRecvPerSec != null && message.hasOwnProperty("bytesRecvPerSec"))
                if (!$util.isInteger(message.bytesRecvPerSec) && !(message.bytesRecvPerSec && $util.isInteger(message.bytesRecvPerSec.low) && $util.isInteger(message.bytesRecvPerSec.high)))
                    return "bytesRecvPerSec: integer|Long expected";
            if (message.bytesSentPerSec != null && message.hasOwnProperty("bytesSentPerSec"))
                if (!$util.isInteger(message.bytesSentPerSec) && !(message.bytesSentPerSec && $util.isInteger(message.bytesSentPerSec.low) && $util.isInteger(message.bytesSentPerSec.high)))
                    return "bytesSentPerSec: integer|Long expected";
            return null;
        };

        /**
         * Creates a NetworkMetrics message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {monitor.NetworkMetrics} NetworkMetrics
         */
        NetworkMetrics.fromObject = function fromObject(object) {
            if (object instanceof $root.monitor.NetworkMetrics)
                return object;
            var message = new $root.monitor.NetworkMetrics();
            if (object.bytesRecvPerSec != null)
                if ($util.Long)
                    (message.bytesRecvPerSec = $util.Long.fromValue(object.bytesRecvPerSec)).unsigned = true;
                else if (typeof object.bytesRecvPerSec === "string")
                    message.bytesRecvPerSec = parseInt(object.bytesRecvPerSec, 10);
                else if (typeof object.bytesRecvPerSec === "number")
                    message.bytesRecvPerSec = object.bytesRecvPerSec;
                else if (typeof object.bytesRecvPerSec === "object")
                    message.bytesRecvPerSec = new $util.LongBits(object.bytesRecvPerSec.low >>> 0, object.bytesRecvPerSec.high >>> 0).toNumber(true);
            if (object.bytesSentPerSec != null)
                if ($util.Long)
                    (message.bytesSentPerSec = $util.Long.fromValue(object.bytesSentPerSec)).unsigned = true;
                else if (typeof object.bytesSentPerSec === "string")
                    message.bytesSentPerSec = parseInt(object.bytesSentPerSec, 10);
                else if (typeof object.bytesSentPerSec === "number")
                    message.bytesSentPerSec = object.bytesSentPerSec;
                else if (typeof object.bytesSentPerSec === "object")
                    message.bytesSentPerSec = new $util.LongBits(object.bytesSentPerSec.low >>> 0, object.bytesSentPerSec.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a NetworkMetrics message. Also converts values to other types if specified.
         * @function toObject
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {monitor.NetworkMetrics} message NetworkMetrics
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        NetworkMetrics.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.bytesRecvPerSec = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.bytesRecvPerSec = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.bytesSentPerSec = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.bytesSentPerSec = options.longs === String ? "0" : 0;
            }
            if (message.bytesRecvPerSec != null && message.hasOwnProperty("bytesRecvPerSec"))
                if (typeof message.bytesRecvPerSec === "number")
                    object.bytesRecvPerSec = options.longs === String ? String(message.bytesRecvPerSec) : message.bytesRecvPerSec;
                else
                    object.bytesRecvPerSec = options.longs === String ? $util.Long.prototype.toString.call(message.bytesRecvPerSec) : options.longs === Number ? new $util.LongBits(message.bytesRecvPerSec.low >>> 0, message.bytesRecvPerSec.high >>> 0).toNumber(true) : message.bytesRecvPerSec;
            if (message.bytesSentPerSec != null && message.hasOwnProperty("bytesSentPerSec"))
                if (typeof message.bytesSentPerSec === "number")
                    object.bytesSentPerSec = options.longs === String ? String(message.bytesSentPerSec) : message.bytesSentPerSec;
                else
                    object.bytesSentPerSec = options.longs === String ? $util.Long.prototype.toString.call(message.bytesSentPerSec) : options.longs === Number ? new $util.LongBits(message.bytesSentPerSec.low >>> 0, message.bytesSentPerSec.high >>> 0).toNumber(true) : message.bytesSentPerSec;
            return object;
        };

        /**
         * Converts this NetworkMetrics to JSON.
         * @function toJSON
         * @memberof monitor.NetworkMetrics
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        NetworkMetrics.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for NetworkMetrics
         * @function getTypeUrl
         * @memberof monitor.NetworkMetrics
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        NetworkMetrics.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/monitor.NetworkMetrics";
        };

        return NetworkMetrics;
    })();

    monitor.DiskMetrics = (function() {

        /**
         * Properties of a DiskMetrics.
         * @memberof monitor
         * @interface IDiskMetrics
         * @property {string|null} [mountPoint] DiskMetrics mountPoint
         * @property {number|Long|null} [usedBytes] DiskMetrics usedBytes
         * @property {number|Long|null} [totalBytes] DiskMetrics totalBytes
         */

        /**
         * Constructs a new DiskMetrics.
         * @memberof monitor
         * @classdesc Represents a DiskMetrics.
         * @implements IDiskMetrics
         * @constructor
         * @param {monitor.IDiskMetrics=} [properties] Properties to set
         */
        function DiskMetrics(properties) {
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * DiskMetrics mountPoint.
         * @member {string} mountPoint
         * @memberof monitor.DiskMetrics
         * @instance
         */
        DiskMetrics.prototype.mountPoint = "";

        /**
         * DiskMetrics usedBytes.
         * @member {number|Long} usedBytes
         * @memberof monitor.DiskMetrics
         * @instance
         */
        DiskMetrics.prototype.usedBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * DiskMetrics totalBytes.
         * @member {number|Long} totalBytes
         * @memberof monitor.DiskMetrics
         * @instance
         */
        DiskMetrics.prototype.totalBytes = $util.Long ? $util.Long.fromBits(0,0,true) : 0;

        /**
         * Creates a new DiskMetrics instance using the specified properties.
         * @function create
         * @memberof monitor.DiskMetrics
         * @static
         * @param {monitor.IDiskMetrics=} [properties] Properties to set
         * @returns {monitor.DiskMetrics} DiskMetrics instance
         */
        DiskMetrics.create = function create(properties) {
            return new DiskMetrics(properties);
        };

        /**
         * Encodes the specified DiskMetrics message. Does not implicitly {@link monitor.DiskMetrics.verify|verify} messages.
         * @function encode
         * @memberof monitor.DiskMetrics
         * @static
         * @param {monitor.IDiskMetrics} message DiskMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        DiskMetrics.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.mountPoint != null && Object.hasOwnProperty.call(message, "mountPoint"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.mountPoint);
            if (message.usedBytes != null && Object.hasOwnProperty.call(message, "usedBytes"))
                writer.uint32(/* id 2, wireType 0 =*/16).uint64(message.usedBytes);
            if (message.totalBytes != null && Object.hasOwnProperty.call(message, "totalBytes"))
                writer.uint32(/* id 3, wireType 0 =*/24).uint64(message.totalBytes);
            return writer;
        };

        /**
         * Encodes the specified DiskMetrics message, length delimited. Does not implicitly {@link monitor.DiskMetrics.verify|verify} messages.
         * @function encodeDelimited
         * @memberof monitor.DiskMetrics
         * @static
         * @param {monitor.IDiskMetrics} message DiskMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        DiskMetrics.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a DiskMetrics message from the specified reader or buffer.
         * @function decode
         * @memberof monitor.DiskMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {monitor.DiskMetrics} DiskMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        DiskMetrics.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.monitor.DiskMetrics();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.mountPoint = reader.string();
                        break;
                    }
                case 2: {
                        message.usedBytes = reader.uint64();
                        break;
                    }
                case 3: {
                        message.totalBytes = reader.uint64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a DiskMetrics message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof monitor.DiskMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {monitor.DiskMetrics} DiskMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        DiskMetrics.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a DiskMetrics message.
         * @function verify
         * @memberof monitor.DiskMetrics
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        DiskMetrics.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.mountPoint != null && message.hasOwnProperty("mountPoint"))
                if (!$util.isString(message.mountPoint))
                    return "mountPoint: string expected";
            if (message.usedBytes != null && message.hasOwnProperty("usedBytes"))
                if (!$util.isInteger(message.usedBytes) && !(message.usedBytes && $util.isInteger(message.usedBytes.low) && $util.isInteger(message.usedBytes.high)))
                    return "usedBytes: integer|Long expected";
            if (message.totalBytes != null && message.hasOwnProperty("totalBytes"))
                if (!$util.isInteger(message.totalBytes) && !(message.totalBytes && $util.isInteger(message.totalBytes.low) && $util.isInteger(message.totalBytes.high)))
                    return "totalBytes: integer|Long expected";
            return null;
        };

        /**
         * Creates a DiskMetrics message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof monitor.DiskMetrics
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {monitor.DiskMetrics} DiskMetrics
         */
        DiskMetrics.fromObject = function fromObject(object) {
            if (object instanceof $root.monitor.DiskMetrics)
                return object;
            var message = new $root.monitor.DiskMetrics();
            if (object.mountPoint != null)
                message.mountPoint = String(object.mountPoint);
            if (object.usedBytes != null)
                if ($util.Long)
                    (message.usedBytes = $util.Long.fromValue(object.usedBytes)).unsigned = true;
                else if (typeof object.usedBytes === "string")
                    message.usedBytes = parseInt(object.usedBytes, 10);
                else if (typeof object.usedBytes === "number")
                    message.usedBytes = object.usedBytes;
                else if (typeof object.usedBytes === "object")
                    message.usedBytes = new $util.LongBits(object.usedBytes.low >>> 0, object.usedBytes.high >>> 0).toNumber(true);
            if (object.totalBytes != null)
                if ($util.Long)
                    (message.totalBytes = $util.Long.fromValue(object.totalBytes)).unsigned = true;
                else if (typeof object.totalBytes === "string")
                    message.totalBytes = parseInt(object.totalBytes, 10);
                else if (typeof object.totalBytes === "number")
                    message.totalBytes = object.totalBytes;
                else if (typeof object.totalBytes === "object")
                    message.totalBytes = new $util.LongBits(object.totalBytes.low >>> 0, object.totalBytes.high >>> 0).toNumber(true);
            return message;
        };

        /**
         * Creates a plain object from a DiskMetrics message. Also converts values to other types if specified.
         * @function toObject
         * @memberof monitor.DiskMetrics
         * @static
         * @param {monitor.DiskMetrics} message DiskMetrics
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        DiskMetrics.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.defaults) {
                object.mountPoint = "";
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.usedBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.usedBytes = options.longs === String ? "0" : 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, true);
                    object.totalBytes = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.totalBytes = options.longs === String ? "0" : 0;
            }
            if (message.mountPoint != null && message.hasOwnProperty("mountPoint"))
                object.mountPoint = message.mountPoint;
            if (message.usedBytes != null && message.hasOwnProperty("usedBytes"))
                if (typeof message.usedBytes === "number")
                    object.usedBytes = options.longs === String ? String(message.usedBytes) : message.usedBytes;
                else
                    object.usedBytes = options.longs === String ? $util.Long.prototype.toString.call(message.usedBytes) : options.longs === Number ? new $util.LongBits(message.usedBytes.low >>> 0, message.usedBytes.high >>> 0).toNumber(true) : message.usedBytes;
            if (message.totalBytes != null && message.hasOwnProperty("totalBytes"))
                if (typeof message.totalBytes === "number")
                    object.totalBytes = options.longs === String ? String(message.totalBytes) : message.totalBytes;
                else
                    object.totalBytes = options.longs === String ? $util.Long.prototype.toString.call(message.totalBytes) : options.longs === Number ? new $util.LongBits(message.totalBytes.low >>> 0, message.totalBytes.high >>> 0).toNumber(true) : message.totalBytes;
            return object;
        };

        /**
         * Converts this DiskMetrics to JSON.
         * @function toJSON
         * @memberof monitor.DiskMetrics
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        DiskMetrics.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for DiskMetrics
         * @function getTypeUrl
         * @memberof monitor.DiskMetrics
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        DiskMetrics.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/monitor.DiskMetrics";
        };

        return DiskMetrics;
    })();

    monitor.SystemMetrics = (function() {

        /**
         * Properties of a SystemMetrics.
         * @memberof monitor
         * @interface ISystemMetrics
         * @property {monitor.ISystemInfo|null} [systemInfo] SystemMetrics systemInfo
         * @property {monitor.ICPUMetrics|null} [cpu] SystemMetrics cpu
         * @property {monitor.IMemoryMetrics|null} [memory] SystemMetrics memory
         * @property {monitor.INetworkMetrics|null} [network] SystemMetrics network
         * @property {Array.<monitor.IDiskMetrics>|null} [disks] SystemMetrics disks
         * @property {number|Long|null} [timestamp] SystemMetrics timestamp
         * @property {number|null} [diskTotalPercent] SystemMetrics diskTotalPercent
         * @property {number|Long|null} [sshLatencyMs] SystemMetrics sshLatencyMs
         */

        /**
         * Constructs a new SystemMetrics.
         * @memberof monitor
         * @classdesc Represents a SystemMetrics.
         * @implements ISystemMetrics
         * @constructor
         * @param {monitor.ISystemMetrics=} [properties] Properties to set
         */
        function SystemMetrics(properties) {
            this.disks = [];
            if (properties)
                for (var keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null)
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SystemMetrics systemInfo.
         * @member {monitor.ISystemInfo|null|undefined} systemInfo
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.systemInfo = null;

        /**
         * SystemMetrics cpu.
         * @member {monitor.ICPUMetrics|null|undefined} cpu
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.cpu = null;

        /**
         * SystemMetrics memory.
         * @member {monitor.IMemoryMetrics|null|undefined} memory
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.memory = null;

        /**
         * SystemMetrics network.
         * @member {monitor.INetworkMetrics|null|undefined} network
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.network = null;

        /**
         * SystemMetrics disks.
         * @member {Array.<monitor.IDiskMetrics>} disks
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.disks = $util.emptyArray;

        /**
         * SystemMetrics timestamp.
         * @member {number|Long} timestamp
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.timestamp = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * SystemMetrics diskTotalPercent.
         * @member {number} diskTotalPercent
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.diskTotalPercent = 0;

        /**
         * SystemMetrics sshLatencyMs.
         * @member {number|Long} sshLatencyMs
         * @memberof monitor.SystemMetrics
         * @instance
         */
        SystemMetrics.prototype.sshLatencyMs = $util.Long ? $util.Long.fromBits(0,0,false) : 0;

        /**
         * Creates a new SystemMetrics instance using the specified properties.
         * @function create
         * @memberof monitor.SystemMetrics
         * @static
         * @param {monitor.ISystemMetrics=} [properties] Properties to set
         * @returns {monitor.SystemMetrics} SystemMetrics instance
         */
        SystemMetrics.create = function create(properties) {
            return new SystemMetrics(properties);
        };

        /**
         * Encodes the specified SystemMetrics message. Does not implicitly {@link monitor.SystemMetrics.verify|verify} messages.
         * @function encode
         * @memberof monitor.SystemMetrics
         * @static
         * @param {monitor.ISystemMetrics} message SystemMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SystemMetrics.encode = function encode(message, writer) {
            if (!writer)
                writer = $Writer.create();
            if (message.systemInfo != null && Object.hasOwnProperty.call(message, "systemInfo"))
                $root.monitor.SystemInfo.encode(message.systemInfo, writer.uint32(/* id 1, wireType 2 =*/10).fork()).ldelim();
            if (message.cpu != null && Object.hasOwnProperty.call(message, "cpu"))
                $root.monitor.CPUMetrics.encode(message.cpu, writer.uint32(/* id 2, wireType 2 =*/18).fork()).ldelim();
            if (message.memory != null && Object.hasOwnProperty.call(message, "memory"))
                $root.monitor.MemoryMetrics.encode(message.memory, writer.uint32(/* id 3, wireType 2 =*/26).fork()).ldelim();
            if (message.network != null && Object.hasOwnProperty.call(message, "network"))
                $root.monitor.NetworkMetrics.encode(message.network, writer.uint32(/* id 4, wireType 2 =*/34).fork()).ldelim();
            if (message.disks != null && message.disks.length)
                for (var i = 0; i < message.disks.length; ++i)
                    $root.monitor.DiskMetrics.encode(message.disks[i], writer.uint32(/* id 5, wireType 2 =*/42).fork()).ldelim();
            if (message.timestamp != null && Object.hasOwnProperty.call(message, "timestamp"))
                writer.uint32(/* id 6, wireType 0 =*/48).int64(message.timestamp);
            if (message.diskTotalPercent != null && Object.hasOwnProperty.call(message, "diskTotalPercent"))
                writer.uint32(/* id 7, wireType 1 =*/57).double(message.diskTotalPercent);
            if (message.sshLatencyMs != null && Object.hasOwnProperty.call(message, "sshLatencyMs"))
                writer.uint32(/* id 8, wireType 0 =*/64).int64(message.sshLatencyMs);
            return writer;
        };

        /**
         * Encodes the specified SystemMetrics message, length delimited. Does not implicitly {@link monitor.SystemMetrics.verify|verify} messages.
         * @function encodeDelimited
         * @memberof monitor.SystemMetrics
         * @static
         * @param {monitor.ISystemMetrics} message SystemMetrics message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SystemMetrics.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer).ldelim();
        };

        /**
         * Decodes a SystemMetrics message from the specified reader or buffer.
         * @function decode
         * @memberof monitor.SystemMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {monitor.SystemMetrics} SystemMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SystemMetrics.decode = function decode(reader, length, error) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            var end = length === undefined ? reader.len : reader.pos + length, message = new $root.monitor.SystemMetrics();
            while (reader.pos < end) {
                var tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.systemInfo = $root.monitor.SystemInfo.decode(reader, reader.uint32());
                        break;
                    }
                case 2: {
                        message.cpu = $root.monitor.CPUMetrics.decode(reader, reader.uint32());
                        break;
                    }
                case 3: {
                        message.memory = $root.monitor.MemoryMetrics.decode(reader, reader.uint32());
                        break;
                    }
                case 4: {
                        message.network = $root.monitor.NetworkMetrics.decode(reader, reader.uint32());
                        break;
                    }
                case 5: {
                        if (!(message.disks && message.disks.length))
                            message.disks = [];
                        message.disks.push($root.monitor.DiskMetrics.decode(reader, reader.uint32()));
                        break;
                    }
                case 6: {
                        message.timestamp = reader.int64();
                        break;
                    }
                case 7: {
                        message.diskTotalPercent = reader.double();
                        break;
                    }
                case 8: {
                        message.sshLatencyMs = reader.int64();
                        break;
                    }
                default:
                    reader.skipType(tag & 7);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SystemMetrics message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof monitor.SystemMetrics
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {monitor.SystemMetrics} SystemMetrics
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SystemMetrics.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SystemMetrics message.
         * @function verify
         * @memberof monitor.SystemMetrics
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SystemMetrics.verify = function verify(message) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (message.systemInfo != null && message.hasOwnProperty("systemInfo")) {
                var error = $root.monitor.SystemInfo.verify(message.systemInfo);
                if (error)
                    return "systemInfo." + error;
            }
            if (message.cpu != null && message.hasOwnProperty("cpu")) {
                var error = $root.monitor.CPUMetrics.verify(message.cpu);
                if (error)
                    return "cpu." + error;
            }
            if (message.memory != null && message.hasOwnProperty("memory")) {
                var error = $root.monitor.MemoryMetrics.verify(message.memory);
                if (error)
                    return "memory." + error;
            }
            if (message.network != null && message.hasOwnProperty("network")) {
                var error = $root.monitor.NetworkMetrics.verify(message.network);
                if (error)
                    return "network." + error;
            }
            if (message.disks != null && message.hasOwnProperty("disks")) {
                if (!Array.isArray(message.disks))
                    return "disks: array expected";
                for (var i = 0; i < message.disks.length; ++i) {
                    var error = $root.monitor.DiskMetrics.verify(message.disks[i]);
                    if (error)
                        return "disks." + error;
                }
            }
            if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                if (!$util.isInteger(message.timestamp) && !(message.timestamp && $util.isInteger(message.timestamp.low) && $util.isInteger(message.timestamp.high)))
                    return "timestamp: integer|Long expected";
            if (message.diskTotalPercent != null && message.hasOwnProperty("diskTotalPercent"))
                if (typeof message.diskTotalPercent !== "number")
                    return "diskTotalPercent: number expected";
            if (message.sshLatencyMs != null && message.hasOwnProperty("sshLatencyMs"))
                if (!$util.isInteger(message.sshLatencyMs) && !(message.sshLatencyMs && $util.isInteger(message.sshLatencyMs.low) && $util.isInteger(message.sshLatencyMs.high)))
                    return "sshLatencyMs: integer|Long expected";
            return null;
        };

        /**
         * Creates a SystemMetrics message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof monitor.SystemMetrics
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {monitor.SystemMetrics} SystemMetrics
         */
        SystemMetrics.fromObject = function fromObject(object) {
            if (object instanceof $root.monitor.SystemMetrics)
                return object;
            var message = new $root.monitor.SystemMetrics();
            if (object.systemInfo != null) {
                if (typeof object.systemInfo !== "object")
                    throw TypeError(".monitor.SystemMetrics.systemInfo: object expected");
                message.systemInfo = $root.monitor.SystemInfo.fromObject(object.systemInfo);
            }
            if (object.cpu != null) {
                if (typeof object.cpu !== "object")
                    throw TypeError(".monitor.SystemMetrics.cpu: object expected");
                message.cpu = $root.monitor.CPUMetrics.fromObject(object.cpu);
            }
            if (object.memory != null) {
                if (typeof object.memory !== "object")
                    throw TypeError(".monitor.SystemMetrics.memory: object expected");
                message.memory = $root.monitor.MemoryMetrics.fromObject(object.memory);
            }
            if (object.network != null) {
                if (typeof object.network !== "object")
                    throw TypeError(".monitor.SystemMetrics.network: object expected");
                message.network = $root.monitor.NetworkMetrics.fromObject(object.network);
            }
            if (object.disks) {
                if (!Array.isArray(object.disks))
                    throw TypeError(".monitor.SystemMetrics.disks: array expected");
                message.disks = [];
                for (var i = 0; i < object.disks.length; ++i) {
                    if (typeof object.disks[i] !== "object")
                        throw TypeError(".monitor.SystemMetrics.disks: object expected");
                    message.disks[i] = $root.monitor.DiskMetrics.fromObject(object.disks[i]);
                }
            }
            if (object.timestamp != null)
                if ($util.Long)
                    (message.timestamp = $util.Long.fromValue(object.timestamp)).unsigned = false;
                else if (typeof object.timestamp === "string")
                    message.timestamp = parseInt(object.timestamp, 10);
                else if (typeof object.timestamp === "number")
                    message.timestamp = object.timestamp;
                else if (typeof object.timestamp === "object")
                    message.timestamp = new $util.LongBits(object.timestamp.low >>> 0, object.timestamp.high >>> 0).toNumber();
            if (object.diskTotalPercent != null)
                message.diskTotalPercent = Number(object.diskTotalPercent);
            if (object.sshLatencyMs != null)
                if ($util.Long)
                    (message.sshLatencyMs = $util.Long.fromValue(object.sshLatencyMs)).unsigned = false;
                else if (typeof object.sshLatencyMs === "string")
                    message.sshLatencyMs = parseInt(object.sshLatencyMs, 10);
                else if (typeof object.sshLatencyMs === "number")
                    message.sshLatencyMs = object.sshLatencyMs;
                else if (typeof object.sshLatencyMs === "object")
                    message.sshLatencyMs = new $util.LongBits(object.sshLatencyMs.low >>> 0, object.sshLatencyMs.high >>> 0).toNumber();
            return message;
        };

        /**
         * Creates a plain object from a SystemMetrics message. Also converts values to other types if specified.
         * @function toObject
         * @memberof monitor.SystemMetrics
         * @static
         * @param {monitor.SystemMetrics} message SystemMetrics
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SystemMetrics.toObject = function toObject(message, options) {
            if (!options)
                options = {};
            var object = {};
            if (options.arrays || options.defaults)
                object.disks = [];
            if (options.defaults) {
                object.systemInfo = null;
                object.cpu = null;
                object.memory = null;
                object.network = null;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.timestamp = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.timestamp = options.longs === String ? "0" : 0;
                object.diskTotalPercent = 0;
                if ($util.Long) {
                    var long = new $util.Long(0, 0, false);
                    object.sshLatencyMs = options.longs === String ? long.toString() : options.longs === Number ? long.toNumber() : long;
                } else
                    object.sshLatencyMs = options.longs === String ? "0" : 0;
            }
            if (message.systemInfo != null && message.hasOwnProperty("systemInfo"))
                object.systemInfo = $root.monitor.SystemInfo.toObject(message.systemInfo, options);
            if (message.cpu != null && message.hasOwnProperty("cpu"))
                object.cpu = $root.monitor.CPUMetrics.toObject(message.cpu, options);
            if (message.memory != null && message.hasOwnProperty("memory"))
                object.memory = $root.monitor.MemoryMetrics.toObject(message.memory, options);
            if (message.network != null && message.hasOwnProperty("network"))
                object.network = $root.monitor.NetworkMetrics.toObject(message.network, options);
            if (message.disks && message.disks.length) {
                object.disks = [];
                for (var j = 0; j < message.disks.length; ++j)
                    object.disks[j] = $root.monitor.DiskMetrics.toObject(message.disks[j], options);
            }
            if (message.timestamp != null && message.hasOwnProperty("timestamp"))
                if (typeof message.timestamp === "number")
                    object.timestamp = options.longs === String ? String(message.timestamp) : message.timestamp;
                else
                    object.timestamp = options.longs === String ? $util.Long.prototype.toString.call(message.timestamp) : options.longs === Number ? new $util.LongBits(message.timestamp.low >>> 0, message.timestamp.high >>> 0).toNumber() : message.timestamp;
            if (message.diskTotalPercent != null && message.hasOwnProperty("diskTotalPercent"))
                object.diskTotalPercent = options.json && !isFinite(message.diskTotalPercent) ? String(message.diskTotalPercent) : message.diskTotalPercent;
            if (message.sshLatencyMs != null && message.hasOwnProperty("sshLatencyMs"))
                if (typeof message.sshLatencyMs === "number")
                    object.sshLatencyMs = options.longs === String ? String(message.sshLatencyMs) : message.sshLatencyMs;
                else
                    object.sshLatencyMs = options.longs === String ? $util.Long.prototype.toString.call(message.sshLatencyMs) : options.longs === Number ? new $util.LongBits(message.sshLatencyMs.low >>> 0, message.sshLatencyMs.high >>> 0).toNumber() : message.sshLatencyMs;
            return object;
        };

        /**
         * Converts this SystemMetrics to JSON.
         * @function toJSON
         * @memberof monitor.SystemMetrics
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SystemMetrics.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SystemMetrics
         * @function getTypeUrl
         * @memberof monitor.SystemMetrics
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SystemMetrics.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/monitor.SystemMetrics";
        };

        return SystemMetrics;
    })();

    return monitor;
})();

export const monitor = $root.monitor;
export default $root;
