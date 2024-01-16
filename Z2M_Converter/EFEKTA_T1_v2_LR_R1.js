const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const extend = require('zigbee-herdsman-converters/lib/extend');
const e = exposes.presets;
const ea = exposes.access;

const tzLocal = {
    node_config: {
        key: ['reading_interval', 'config_report_enable', 'comparison_previous_data'],
        convertSet: async (entity, key, rawValue, meta) => {
            const lookup = {'OFF': 0x00, 'ON': 0x01};
            const value = lookup.hasOwnProperty(rawValue) ? lookup[rawValue] : parseInt(rawValue, 10);
            const payloads = {
                reading_interval: ['genPowerCfg', {0x0201: {value, type: 0x21}}],
				config_report_enable: ['genPowerCfg', {0x0275: {value, type: 0x10}}],
				comparison_previous_data: ['genPowerCfg', {0x0205: {value, type: 0x10}}],
            };
            await entity.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
	termostat_config: {
        key: ['high_temp', 'low_temp', 'enable_temp', 'invert_logic_temp'],
        convertSet: async (entity, key, rawValue, meta) => {
            const lookup = {'OFF': 0x00, 'ON': 0x01};
            const value = lookup.hasOwnProperty(rawValue) ? lookup[rawValue] : parseInt(rawValue, 10);
            const payloads = {
                high_temp: ['msTemperatureMeasurement', {0x0221: {value, type: 0x29}}],
                low_temp: ['msTemperatureMeasurement', {0x0222: {value, type: 0x29}}],
				enable_temp: ['msTemperatureMeasurement', {0x0220: {value, type: 0x10}}],
				invert_logic_temp: ['msTemperatureMeasurement', {0x0225: {value, type: 0x10}}],
            };
            await entity.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
};

const fzLocal = {
    node_config: {
        cluster: 'genPowerCfg',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty(0x0201)) {
                result.reading_interval = msg.data[0x0201];
            }
			if (msg.data.hasOwnProperty(0x0275)) {
				result.config_report_enable = ['OFF', 'ON'][msg.data[0x0275]];
            }
			if (msg.data.hasOwnProperty(0x0205)) {
				result.comparison_previous_data = ['OFF', 'ON'][msg.data[0x0205]];
            }
            return result;
        },
    },
	termostat_config: {
        cluster: 'msTemperatureMeasurement',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty(0x0221)) {
                result.high_temp = msg.data[0x0221];
            }
			if (msg.data.hasOwnProperty(0x0222)) {
                result.low_temp = msg.data[0x0222];
            }
            if (msg.data.hasOwnProperty(0x0220)) {
                result.enable_temp = ['OFF', 'ON'][msg.data[0x0220]];
            }
			if (msg.data.hasOwnProperty(0x0225)) {
                result.invert_logic_temp = ['OFF', 'ON'][msg.data[0x0225]];
            }
			if (msg.data.hasOwnProperty(0xA19B)) {
                result.sensor_identifier = msg.data[0xA19B];
            }
            return result;
        },
    },
};

const definition = {
        zigbeeModel: ['EFEKTA_T1_v2_LR'],
        model: 'EFEKTA_T1_v2_LR',
        vendor: 'EfektaLab',
        description: 'EFEKTA_T1_v2_LR - temperature sensors with a signal amplifier. The device is equipped with a remote temperature sensor DS18b20. Simple Thermostat.',
        fromZigbee: [fz.temperature, fz.battery, fzLocal.termostat_config, fzLocal.node_config],
        toZigbee: [tz.factory_reset, tzLocal.termostat_config, tzLocal.node_config],
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpointOne = device.getEndpoint(1);
            await reporting.bind(endpointOne, coordinatorEndpoint, ['genPowerCfg', 'msTemperatureMeasurement']);
			const overrides1 = {min: 0, max: 43200, change: 1};
			const overrides2 = {min: 0, max: 1200, change: 10};
            await reporting.batteryVoltage(endpointOne, overrides1);
            await reporting.batteryPercentageRemaining(endpointOne, overrides1);
			await reporting.batteryAlarmState(endpointOne, overrides1);
            await reporting.temperature(endpointOne, overrides2);
        },
        icon: 'data:image/jpeg;base64,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AABSZ3NNYm9vbAAAAAAAQ3JuQ2Jvb2wAAAAAAENudENib29sAAAAAABMYmxzYm9vbAAAAAAATmd0dmJvb2wAAAAAAEVtbERib29sAAAAAABJbnRyYm9vbAAAAAAAQmNrZ09iamMAAAABAAAAAAAAUkdCQwAAAAMAAAAAUmQgIGRvdWJAb+AAAAAAAAAAAABHcm4gZG91YkBv4AAAAAAAAAAAAEJsICBkb3ViQG/gAAAAAAAAAAAAQnJkVFVudEYjUmx0AAAAAAAAAAAAAAAAQmxkIFVudEYjUmx0AAAAAAAAAAAAAAAAUnNsdFVudEYjUHhsQFIAAAAAAAAAAAAKdmVjdG9yRGF0YWJvb2wBAAAAAFBnUHNlbnVtAAAAAFBnUHMAAAAAUGdQQwAAAABMZWZ0VW50RiNSbHQAAAAAAAAAAAAAAABUb3AgVW50RiNSbHQAAAAAAAAAAAAAAABTY2wgVW50RiNQcmNAWQAAAAAAAAAAABBjcm9wV2hlblByaW50aW5nYm9vbAAAAAAOY3JvcFJlY3RCb3R0b21sb25nAAAAAAAAAAxjcm9wUmVjdExlZnRsb25nAAAAAAAAAA1jcm9wUmVjdFJpZ2h0bG9uZwAAAAAAAAALY3JvcFJlY3RUb3Bsb25nAAAAAAA4QklNA+0AAAAAABAASAAAAAEAAQBIAAAAAQABOEJJTQQmAAAAAAAOAAAAAAAAAAAAAD+AAAA4QklNBA0AAAAAAAQAAAAeOEJJTQQZAAAAAAAEAAAAHjhCSU0D8wAAAAAACQAAAAAAAAAAAQA4QklNJxAAAAAAAAoAAQAAAAAAAAABOEJJTQP1AAAAAABIAC9mZgABAGxmZgAGAAAAAAABAC9mZgABAKGZmgAGAAAAAAABADIAAAABAFoAAAAGAAAAAAABADUAAAABAC0AAAAGAAAAAAABOEJJTQP4AAAAAABwAAD/////////////////////////////A+gAAAAA/////////////////////////////wPoAAAAAP////////////////////////////8D6AAAAAD/////////////////////////////A+gAADhCSU0EAAAAAAAAAgABOEJJTQQCAAAAAAAEAAAAADhCSU0EMAAAAAAAAgEBOEJJTQQtAAAAAAAGAAEAAAACOEJJTQQI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bWVudHMvMS4xLyIgeG1sbnM6cGhvdG9zaG9wPSJodHRwOi8vbnMuYWRvYmUuY29tL3Bob3Rvc2hvcC8xLjAvIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDUtMDFUMTQ6MzA6NDkrMDM6MDAiIHhtcDpNZXRhZGF0YURhdGU9IjIwMjQtMDEtMTZUMjM6Mjk6MjcrMDM6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDI0LTAxLTE2VDIzOjI5OjI3KzAzOjAwIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOmI4ODE2YThkLTMyZjktYWQ0YS04NjQ3LWY1NzI0MDkyZGIyOCIgeG1wTU06RG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjk0ZWE3MDQwLWRhMjAtNzM0Ny04MmJiLTlmMDNmNDU2YmIwNyIgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjAyMWZmYzJkLWU2NGEtNTk0Yy05YWEyLTU3YTgzOGU5YzQ0OSIgZGM6Zm9ybWF0PSJpbWFnZS9qcGVnIiBwaG90b3Nob3A6Q29sb3JNb2RlPSIzIiBwaG90b3Nob3A6SUNDUHJvZmlsZT0iQWRvYmUgUkdCICgxOTk4KSI+IDx4bXBNTTpIaXN0b3J5PiA8cmRmOlNlcT4gPHJkZjpsaSBzdEV2dDphY3Rpb249ImNyZWF0ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6MDIxZmZjMmQtZTY0YS01OTRjLTlhYTItNTdhODM4ZTljNDQ5IiBzdEV2dDp3aGVuPSIyMDIzLTA1LTAxVDE0OjMwOjQ5KzAzOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoV2luZG93cykiLz4gPHJkZjpsaSBzdEV2dDphY3Rpb249InNhdmVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjkyMTFiNmNmLWE4NmEtMzM0ZS05ZTM2LTJkMmZiYTFhOTJjNSIgc3RFdnQ6d2hlbj0iMjAyMy0wNS0wMVQxNDozMDo0OSswMzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKFdpbmRvd3MpIiBzdEV2dDpjaGFuZ2VkPSIvIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDo3ZDljNWMzNC03ZWE1LTliNDEtYTUzMS0zMjk4NzUyNjgyY2EiIHN0RXZ0OndoZW49IjIwMjQtMDEtMTZUMjM6Mjk6MjcrMDM6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0iY29udmVydGVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJmcm9tIGltYWdlL3BuZyB0byBpbWFnZS9qcGVnIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJkZXJpdmVkIiBzdEV2dDpwYXJhbWV0ZXJzPSJjb252ZXJ0ZWQgZnJvbSBpbWFnZS9wbmcgdG8gaW1hZ2UvanBlZyIvPiA8cmRmOmxpIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6Yjg4MTZhOGQtMzJmOS1hZDRhLTg2NDctZjU3MjQwOTJkYjI4IiBzdEV2dDp3aGVuPSIyMDI0LTAxLTE2VDIzOjI5OjI3KzAzOjAwIiBzdEV2dDpzb2Z0d2FyZUFnZW50PSJBZG9iZSBQaG90b3Nob3AgQ0MgMjAxOCAoV2luZG93cykiIHN0RXZ0OmNoYW5nZWQ9Ii8iLz4gPC9yZGY6U2VxPiA8L3htcE1NOkhpc3Rvcnk+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjdkOWM1YzM0LTdlYTUtOWI0MS1hNTMxLTMyOTg3NTI2ODJjYSIgc3RSZWY6ZG9jdW1lbnRJRD0iYWRvYmU6ZG9jaWQ6cGhvdG9zaG9wOjQ4OWQyNzEwLWU2MTUtYTE0NS1hZjk1LWQzNTE2YzNkMDM5MCIgc3RSZWY6b3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjAyMWZmYzJkLWU2NGEtNTk0Yy05YWEyLTU3YTgzOGU5YzQ0OSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+/+ICQElDQ19QUk9GSUxFAAEBAAACMEFEQkUCEAAAbW50clJHQiBYWVogB88ABgADAAAAAAAAYWNzcEFQUEwAAAAAbm9uZQAAAAAAAAAAAAAAAAAAAAAAAPbWAAEAAAAA0y1BREJFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKY3BydAAAAPwAAAAyZGVzYwAAATAAAABrd3RwdAAAAZwAAAAUYmtwdAAAAbAAAAAUclRSQwAAAcQAAAAOZ1RSQwAAAdQAAAAOYlRSQwAAAeQAAAAOclhZWgAAAfQAAAAUZ1hZWgAAAggAAAAUYlhZWgAAAhwAAAAUdGV4dAAAAABDb3B5cmlnaHQgMTk5OSBBZG9iZSBTeXN0ZW1zIEluY29ycG9yYXRlZAAAAGRlc2MAAAAAAAAAEUFkb2JlIFJHQiAoMTk5OCkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAADzUQABAAAAARbMWFlaIAAAAAAAAAAAAAAAAAAAAABjdXJ2AAAAAAAAAAECMwAAY3VydgAAAAAAAAABAjMAAGN1cnYAAAAAAAAAAQIzAABYWVogAAAAAAAAnBgAAE+lAAAE/FhZWiAAAAAAAAA0jQAAoCwAAA+VWFla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',
		exposes: [e.temperature(), e.battery_low(), e.battery(), e.battery_voltage(),
		    exposes.numeric('reading_interval', ea.STATE_SET).withUnit('Seconds').withDescription('Setting the sensor reading interval. Setting the time in seconds, by default 40 seconds.')
                .withValueMin(10).withValueMax(360),
			exposes.binary('config_report_enable', ea.STATE_SET, 'ON', 'OFF').withDescription('Enable reporting based on reporting configuration'),
		    exposes.binary('comparison_previous_data', ea.STATE_SET, 'ON', 'OFF').withDescription('Enable сontrol of comparison with previous data'),
		    exposes.binary('enable_temp', ea.STATE_SET, 'ON', 'OFF').withDescription('Enable Temperature Control'),
		    exposes.binary('invert_logic_temp', ea.STATE_SET, 'ON', 'OFF').withDescription('Invert Logic Temperature Control'),
            exposes.numeric('high_temp', ea.STATE_SET).withUnit('C').withDescription('Setting High Temperature Border')
                .withValueMin(-50).withValueMax(120),
            exposes.numeric('low_temp', ea.STATE_SET).withUnit('C').withDescription('Setting Low Temperature Border')
                .withValueMin(-50).withValueMax(120),				
			exposes.numeric('sensor_identifier', ea.STATE).withDescription('Sensor type, identifier')],
};

module.exports = definition;
