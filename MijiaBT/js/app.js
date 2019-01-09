

const app = new Vue({
    data: {
        scanning: false,
        showLoading: false,
        refreshing: false,

        debugEnabled: false,
        debugView: false,
        debug_data: [],

        devices: [],
        selectedDevice : null,
        bt_devices: [],
        advertiseWatcher : null
        
    },
    methods: {
        scan: function () {
            let self = this;

            this.showLoading = true;
            let selector = 'System.Devices.DevObjectType:=5 AND System.Devices.Aep.ProtocolId:="{BB7BB05E-5972-42B5-94FC-76EAA7084D49}"';// AND System.ItemNameDisplay:~~"MJ_HT_V1"';
            //let selector = Windows.Devices.Bluetooth.BluetoothLEDevice.getDeviceSelector();

            self.bt_devices = [];
            let filter = [];
            self.devices.forEach((d) => { filter.push(d.id); });



            Windows.Devices.Enumeration.DeviceInformation.findAllAsync(selector, null, Windows.Devices.Enumeration.DeviceInformationKind.device).then((found) => {
                self.scanning = true;
          
                found.forEach((d) => {
                    if (filter.indexOf(d.id) < 0)
                        self.bt_devices.push(d);
                });
                
                this.showLoading = false;
            });

            
           

            //var deviceWatcher = Windows.Devices.Enumeration.DeviceInformation.createWatcher(selector, null, Windows.Devices.Enumeration.DeviceInformationKind.device);
            //deviceWatcher.onadded = function (d) {
            //    self.scanning = true;
            //    console.log(d);
            //    if (filter.indexOf(d.id) < 0)
            //        self.bt_devices.push(d);
            //};
            //deviceWatcher.onupdated = function (type) {

            //};
            //deviceWatcher.onremoved = function (type) {

            //};
            //deviceWatcher.onstopped = function () {
            //    self.showLoading = false;
            //};


            //deviceWatcher.start();
            ////stop after 30 sec
            //setTimeout(() => { deviceWatcher.stop(); }, 30000);



        },
        listen: function () {
            let self = this;
            let filter = [];
            self.devices.forEach((d) => {
                filter.push(d.address);
            });

            if (self.advertiseWatcher !== null)
                delete self.advertiseWatcher;


            self.advertiseWatcher = new Windows.Devices.Bluetooth.Advertisement.BluetoothLEAdvertisementWatcher();
            self.advertiseWatcher.onreceived = function (args) {
                

                if (filter.indexOf(args.bluetoothAddress) < 0)
                    return;
                var data = args.advertisement.dataSections[1];

                self.refreshing = true;

                let device = self.devices.find((c) => { return c.address === args.bluetoothAddress; });
                device.values.length = 5;  

                self.readStringFromStream(data.data);

                switch (data.data.length) {
                    case 20:                       
                        var sensorData = {};
                        sensorData.temperature = (self.readUint16FromStream(data.data, 4) / 10).toFixed(1);
                        sensorData.humidity = (self.readUint16FromStream(data.data, 2) / 10).toFixed(1);
                        device.values.unshift(sensorData);
                        device.online = true;
                        break;
                    //case 18:                        
                    //    device.humidity = self.readUint16FromStream(data.data, 2);
                    //    break;
                    case 17:                        
                        device.battery = self.readUint8FromStream(data.data, 1);
                        break;                    
                        
                }
                self.refreshing = false;

               
                

            };
            self.advertiseWatcher.start();
                        

            return;
        },
        addDevice: function (bt_device) {
            let self = this;

            self.showLoading = false;

            let device = { name: bt_device.name + ' ' + bt_device.id.substr(bt_device.id.length - 5), id: bt_device.id, type: bt_device.name, values: [] ,battery:-1};
            device.address = parseInt(device.id.split('-')[1].replace(/:/g, ''), 16);
            this.devices.push(device);
            this.scanning = false;

            if (bt_device.pairing.ispaired)
                bt_device.pairing.pairAsync().done(() => {
                    self.registerNotifications(device);
                });
            else
                self.registerNotifications(device);

            // save 
            localStorage.setItem('devices', JSON.stringify(this.devices));
            


        },
        removeDevice: function (device) {
            this.devices.forEach(function (d, i) {
                if (d === device) {
                    // someArray.splice(i, 1);
                    console.log(i);
                    return false;
                }
            });
            localStorage.setItem('devices', JSON.stringify(this.devices));
        },
        editDevice: function (device) {
            this.selectedDevice = device;
        },
        registerNotifications: function (device) {

            let self = this;
            if (device.values === null)
                device.values = [];
            device.online = false;
            //temp & hum 226caa55-6476-4566-7562-66734470666d  => 26caa55-6476-4566-7562-66734470666d
            //battery 0000180f-0000-1000-8000-00805f9b34fb => 00002a19-0000-1000-8000-00805f9b34fb
            switch (device.type) {
                case 'MJ_HT_V1':
                    device.values.length = 5;
                    self.refreshing = true;
                    this.readSensorData(device, '226c0000-6476-4566-7562-66734470666d', '226caa55-6476-4566-7562-66734470666d').then((data) => {
                        var groups = (/T=(\d*\.\d*)\sH=(\d*\.\d*)/g).exec(data);
                        device.values.unshift({ temperature: groups[1], humidity: groups[2] });
                        self.refreshing = false;
                    });

                    break;
                default:
                    break;
            }
        },
        readSensorData: function (device,serviceUid, charUid) {
            let self = this;
            return new Promise(function (resolve, reject) {               
           
                Windows.Devices.Bluetooth.BluetoothLEDevice.fromIdAsync(device.id).then((ble) => {

                        ble.getGattServicesForUuidAsync(serviceUid).then((s) => {

                            if (s.status !== Windows.Devices.Bluetooth.GenericAttributeProfile.GattCommunicationStatus.success) {
                                
                                reject();
                            }
                            else {
                                device.online = true;
                                s.services[0].getCharacteristicsForUuidAsync(charUid.toString()).then((char) => {
                                    switch (char.characteristics[0].characteristicProperties) {
                                        case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.notify:
                                            char.characteristics[0].onvaluechanged = function (args) {

                                                let data = self.readStringFromStream(args.characteristicValue);
                                                self.debug("data", data);
                                                char.characteristics[0].writeClientCharacteristicConfigurationDescriptorAsync(Windows.Devices.Bluetooth.GenericAttributeProfile.GattClientCharacteristicConfigurationDescriptorValue.none);
                                                resolve(data);
                                            };
                                            char.characteristics[0].writeClientCharacteristicConfigurationDescriptorAsync(Windows.Devices.Bluetooth.GenericAttributeProfile.GattClientCharacteristicConfigurationDescriptorValue.notify);
                                            break;
                                        case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.indicate:
                                            char.characteristics[0].onvaluechanged = function (args) {

                                                let data = self.readStringFromStream(args.characteristicValue);
                                                self.debug("data", data);
                                                char.characteristics[0].writeClientCharacteristicConfigurationDescriptorAsync(Windows.Devices.Bluetooth.GenericAttributeProfile.GattClientCharacteristicConfigurationDescriptorValue.none);
                                                resolve(data);
                                            };
                                            char.characteristics[0].writeClientCharacteristicConfigurationDescriptorAsync(Windows.Devices.Bluetooth.GenericAttributeProfile.GattClientCharacteristicConfigurationDescriptorValue.indicate);
                                            break;
                                        default:
                                            char.characteristics[0].readValueAsync((rawData) => {
                                                let data = self.readStringFromStream(rawData.value);
                                                self.debug("data", data);
                                                resolve(data);
                                            });
                                            break;
                                    }
                                    
                                    
                                    
                                }, reject);
                            }
                        }, reject);
                    
                }, reject);

            });
            
        },
        getInformations: function (device) {

            let self = this;
            // connect to device 
            Windows.Devices.Bluetooth.BluetoothLEDevice.fromIdAsync(device.id).then((ble) => {
                ble.requestAccessAsync().then(() => {
                    ble.gattServices.forEach((service) => {
                        

                        service.getAllCharacteristics().forEach((c) => {

                            var flag = ['characteristic : ' + c.uuid, 'flag : ' ];
                            switch (c.characteristicProperties) {
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.read:
                                    flag[1] += 'read';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.write:
                                    flag[1] += ' write';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.notify:
                                    flag[1] += 'notify';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.broadcast:
                                    flag[1] += 'broadcast';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.authenticatedSignedWrites:
                                    flag[1] += 'authenticatedSignedWrites';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.extendedProperties:
                                    flag[1] += 'extendedProperties';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.indicate:
                                    flag[1] += 'indicate';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.reliableWrites:
                                    flag[1] += 'reliableWrites';
                                    break;
                                case Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.writableAuxiliaries:
                                    flag[1] += 'writableAuxiliaries';
                                    break;

                                default:
                                    flag[1] += 'none';
                                    break;
                            }
                            

                            if (c.characteristicProperties === Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.read ||
                                c.characteristicProperties === Windows.Devices.Bluetooth.GenericAttributeProfile.GattCharacteristicProperties.notify) {
                                c.readValueAsync(Windows.Devices.Bluetooth.BluetoothCacheMode.uncached).then((d) => {
                                    var value = '';
                                    if (d.value !== null)
                                        flag.push('value : ' + self.readStringFromStream(d.value));
                                    self.debug(service.uuid, flag.join('<br />'));

                                });
                            }
                            else 
                                self.debug(service.uuid, flag.join('<br />'));
                        });
                    });
                });
            });
        },
        readStringFromStream: function (stream) {
            let result = new Uint8Array(stream.length);
            let reader = Windows.Storage.Streams.DataReader.fromBuffer(stream);            
            reader.readBytes(result);
            var hex = Array.from(result, function (byte) {
                return ('0' + (byte & 0xFF).toString(16)).slice(-2);
            }).join(':');

            this.debug('readStringFromStream HEX', hex);

            return String.fromCharCode.apply(null, result);
        },
        readUint16FromStream: function (stream, offset) {
            var raw = new Uint8Array(stream.length);
            let reader = Windows.Storage.Streams.DataReader.fromBuffer(stream);
            reader.readBytes(raw);

            var uint16Array = new Uint16Array(
                raw.buffer,
                raw.byteOffset + raw.byteLength - offset
            );
            this.debug('readUint16FromStream', uint16Array[0]);
            return uint16Array[0];
        },        
        readUint8FromStream: function (stream, offset) {
            var raw = new Uint8Array(stream.length);
            let reader = Windows.Storage.Streams.DataReader.fromBuffer(stream);
            reader.readBytes(raw);

            var uint8Array = new Uint8Array(
                raw.buffer,
                raw.byteOffset + raw.byteLength - offset
            );
            this.debug('readUint16FromStream', uint8Array[0]);
            return uint8Array[0];
        },
        /* debug */
        debug: function (name, data) {
            if (this.debugEnabled)
                this.debug_data.push(name + ':' + data);
        }
        
    },
    mounted: function () {
        console.log("heart beat");
        var self = this;
        self.devices = JSON.parse(localStorage.getItem('devices')) || [];


        if (self.devices.length > 0) {
            self.devices.forEach((d) => {

                if (self.debugEnabled)
                    self.getInformations(d);

                self.registerNotifications(d);
            });

        }

        self.listen();

    }
}).$mount('#app');
