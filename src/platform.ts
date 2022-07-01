/* eslint-disable max-len */
/* eslint-disable no-console */
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic, CharacteristicValue } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { Device } from './platformAccessory';
import { Light } from './platformAccessory';
import { Dimmer } from './platformAccessory';
import { WindowCovering } from './platformAccessory';
import { Conditioner } from './platformAccessory';
import { WarmFloor } from './platformAccessory';

import fetch from 'node-fetch';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

export type Payload = {
  [details:string] : string | number | boolean | CharacteristicValue;
};

export type RequestParams = {
  method: string;
  payload: Payload;
};

import { createClient } from 'redis';

export async function http_request(type_request: string, params: RequestParams) {
  try {
    // 👇️ const response: Response
    const request_base = {
      method: type_request,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
    const request = request_base;
    const request_string = `https://localhost/homebridge?method=${params.method}&payload=${JSON.stringify(params.payload)}`;
    const response = await fetch(`${request_string}`, request);

    if (!response.ok) {
      throw new Error(`Error! status: ${response.status}`);
    }
    // const result = await response.json();
    const result = await response.json();

    // console.log('result is: ', JSON.stringify(result, null, 4));

    return result;
  } catch (error) {
    if (error instanceof Error) {
      console.log('error message: ', error.message);
      return error.message;
    } else {
      console.log('unexpected error: ', error);
      return 'An unexpected error occurred';
    }
  }
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class AnimaHomeHomebridgePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private readonly uuid_prefix = '00777077-0000-1000-8000-';
  private readonly type_to_class = {
    '41' : Light,
    '42' : Dimmer,
    '43' : Dimmer,
    '44' : Dimmer,
    '4a' : Dimmer,
    '46' : Dimmer,
    '48' : Dimmer,
    '49' : Dimmer,
    '33' : WindowCovering,
    '38' : WindowCovering,
    '67' : Conditioner,
    '72' : WarmFloor,
  };

  private classes_instances : Device[];

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);
    this.classes_instances = [];

    const client = createClient({url: `redis://localhost:6379`});
    client.connect();
    const subscriber = client.duplicate();
    subscriber.connect();
    subscriber.subscribe('to_homebridge', (message) => {
      console.log(new Date(), message); // 'message'
      const payload = JSON.parse(message);
      console.log(payload);
      const method = payload.method;
      if (method === 'set_value') {
        const property_address = payload.address;
        const device_address = property_address.slice(0, 12).toLowerCase();
        const value = payload.value;
        // console.log('classes_instances = ', this.classes_instances);
        for (const instance of this.classes_instances){
          if(instance.compare_address(device_address)) {
            instance.set_value(property_address, value);
            break;
          }
        }
      } else if (method === 'devices') {
        this.discoverDevices();
      }
    });

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  async discoverDevices() {
    const Devices = await http_request('GET', {method: 'devices', payload: {}});
    const devices_addresses = Object.keys(Devices);
    this.log.info('devices_addresses', devices_addresses);
    this.log.info('this.accessories before remove:', this.accessories.length === 0 ? 'empty' : 'not empty');
    for (const accessory of this.accessories) {
      if (devices_addresses.find(uuid => (this.uuid_prefix + uuid).toLowerCase() === accessory.UUID) === undefined) {
        this.log.info('Zdraste...');
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        let index = this.accessories.indexOf(accessory);
        while (index > -1) {
          this.accessories.splice(index, 1);
          index = this.accessories.indexOf(accessory);
        }
        this.log.info('this.accessories after remove:', this.accessories.length === 0 ? 'empty' : 'not empty');
      }
    }

    // loop over the discovered devices and register each one if it has not already been registered
    const uids = Object.keys(Devices);
    for (const uid of uids) {
      this.log.info('device: ', Devices[uid]);
      const uuid = this.uuid_prefix + uid.toLowerCase();
      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      this.log.info('this.accessories before add/exist:', this.accessories.length === 0 ? 'empty' : 'not empty');
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        // the accessory already exists
        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.context.device = Devices[uid];
        this.api.updatePlatformAccessories([existingAccessory]);


        const dev_type = existingAccessory.UUID.split('-')[4].slice(8, 10);
        if (Object.keys(this.type_to_class).includes(dev_type)) {
          this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
          this.classes_instances.push(new this.type_to_class[dev_type](this, existingAccessory));
        }
      } else {
        // the accessory does not yet exist, so we need to create it

        // create a new accessory
        const accessory = new this.api.platformAccessory(Devices[uid].name, uuid);
        const dev_type = accessory.UUID.split('-')[4].slice(8, 10);
        if (Object.keys(this.type_to_class).includes(dev_type)) {
          accessory.context.device = Devices[uid];
          this.classes_instances.push(new this.type_to_class[dev_type](this, accessory));
          this.log.info('Adding new accessory:', accessory.displayName);
          this.accessories.push(accessory);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
          this.log.info('this.accessories after add:', this.accessories.length === 0 ? 'empty' : 'not empty');
        }
      }
    }
  }
}
