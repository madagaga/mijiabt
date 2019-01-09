Vue.component('mj_ht_v1',
    {
        template: `<div class="mijia_bt">
                <div class= "mijia_bt_border" >
                    <div class="mijia_bt_content" v-if="ready">
                        <div class="mijia_bt_battery">
                            <i class="icon-btn" v-bind:class="batteryClass"></i>
                        </div>
                        <h1 class="mijia_bt_temp">
                            <div>{{ temperature.split('.')[0] }}</div>
                            <div class="decimal">.{{ temperature.split('.')[1] }}</div>
                            <div class="unit">°C</div>
                        </h1>\
                        <h1 class="mijia_bt_hum">
                            <div>{{ humidity.split('.')[0] }}</div>
                            <div class="decimal">.{{ humidity.split('.')[1] }}</div>
                            <div class="unit">%</div>
                        </h1>
                    </div>
                    <span v-else>Loading ... </span>
                    <div class="mijia_bt_name w3-block"  v-bind:class="{'w3-green' : (device.online), 'w3-red' : (!device.online)}"  v-on:click="editing = !editing" >{{ device.name }} </div>
                    <div class="mijia_bt_action w3-block w3-blue-grey"  v-bind:class="{'in' : (editing)}" v-on:click="editing = !editing">
                          <a class="w3-button w3-circle icon-btn icon-refresh" v-on:click="refresh();"></a>
                          <a class="w3-button w3-circle icon-btn icon-edit" v-on:click="edit();"></a>
                          <a class="w3-button w3-circle icon-btn icon-delete w3-red" v-on:click="remove();"></a>
                          
                    </div>
                </div>
             </div>`,
        props: ['device'],
        data: function () {
            return {
                editing: false
            };
        },       
        computed: {
            ready: function () {
                return this.device !== null &&
                    this.device.values !== null &&
                    this.device.values.length > 0 &&
                    this.device.values[0] != null;
            },
            batteryClass: function () {
                if (this.device.battery > -1)
                    return 'icon-battery' + Math.ceil(this.device.battery / 25);
                else return '';
            },
            temperature: function () {
                return this.device.values[0].temperature || null;
            },
            humidity: function () {
                return this.device.values[0].humidity || null;
            }
        },
        methods: {
            edit: function () {
                this.$root.editDevice(this.device);
            },
            refresh: function () {
                this.$root.registerNotifications(this.device);
                this.$root.listen();
            },
            remove: function () {
                this.$root.removeDevice(this.device);
            }
        },
        mounted: function () {
            let self = this;           

        }
    });