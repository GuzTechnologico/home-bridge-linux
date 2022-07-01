/* eslint-disable max-len */
/* eslint-disable no-console */
import { Service, PlatformAccessory, CharacteristicValue, Characteristic, CharacteristicEventTypes } from 'homebridge';
// import { forceColor } from 'homebridge/lib/logger';

import { AnimaHomeHomebridgePlatform } from './platform';

import { http_request } from './platform';
import { RequestParams } from './platform';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
// export class ExamplePlatformAccessory {
export abstract class Device {
  protected address : string;
  protected address_slice : string;

  constructor(
    protected readonly platform: AnimaHomeHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    this.address = accessory.UUID.split('-')[4];
    this.address_slice = this.address.slice(4, 12);
  }


  public compare_address(addr :string) {
    return this.address === addr;
  }

  set_value (property_full_address : string, fvalue : string) {
    console.log(`This is the base class. Call the method on the appropriate child.\n\
    property_full_address: ${property_full_address}\n\
    fvalue: ${fvalue}`);
  }

  protected type_to_type = {
    'On' : '01',
    'Opened' : '04',
    'Brightness' : '20',
    'Temperature' : '21',
  };

  tf_to_bool(fvalue : string) {
    return fvalue === 't' ? true : false;
  }

  bool_to_tf(value : boolean | CharacteristicValue) {
    return value === true ? 't' : 'f';
  }

  stringFloat_to_int(fvalue : string) {
    return Math.floor(parseFloat(fvalue));
  }

  number_to_position(target: number, current: number) {
    if (target > current) {
      return 't';
    } else if (target < current) {
      return 'f';
    } else {
      return undefined;
    }
  }

  tf_to_int(fvalue : string) {
    return fvalue === 't' ? 100 : 0;
  }

  active_to_tf(value : number | CharacteristicValue) {
    return value === 1 ? 't' : 'f';
  }

  tf_to_active(fvalue : string) {
    return fvalue === 't' ? 1 : 0;
  }

  tf_to_HCS(fvalue : string) {
    return fvalue === 't' ? 2 : 0 as number;
  }

  HCS_to_tf(value : number | CharacteristicValue) {
    return value > 0 ? 't' : 'f';
  }
}

export class Light extends Device {
  private service: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private Properties = {
    On: false,
  };

  constructor(
    protected readonly platform: AnimaHomeHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    console.log('address: ', this.address);

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LLC "Technologico"')
      .setCharacteristic(this.platform.Characteristic.Model, 'Relay')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0000-0000-0000-0000');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
  }

  set_value (property_full_address : string, fvalue : string) {
    const property = property_full_address.slice(12, 14);
    if (property === '01') {
      const value = this.tf_to_bool(fvalue);
      this.service.updateCharacteristic('On', value);
      this.Properties.On = value;
    }
  }

  getName() {
    return 'Light';
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    // implement your own code to turn your device on/off
    const property_full_address = this.address + this.type_to_type.On + '00';
    const fvalue = this.bool_to_tf(value);
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);
    this.Properties.On = value as boolean;
    //this.platform.log.info(`Set Characteristic On (${this.getName()}) ->`, value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    // implement your own code to check if the device is on
    const property_address = this.address_slice + this.type_to_type.On + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.On = this.tf_to_bool(data.fvalue);

    //this.platform.log.info(`Get Characteristic On (${this.getName()}) ->`, this.Properties.On);

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return this.Properties.On;
  }
}

export class Dimmer extends Device {
  private service: Service;

  private Properties = {
    On: false,
    Brightness: 100,
  };

  constructor(
    protected readonly platform: AnimaHomeHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.address = accessory.UUID.split('-')[4];
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LLC "Technologico"')
      .setCharacteristic(this.platform.Characteristic.Model, 'Dimmer')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0000-0000-0000-0001');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))        // SET - bind to the 'setBrightness` method below
      .onGet(this.getBrightness.bind(this));       // GET - bind to the 'getBrightness` method below
  }

  set_value (property_full_address : string, fvalue : string) {
    console.log('Menya vyzvali');
    const property = property_full_address.slice(12, 14);
    if (property === '01') {
      const value = this.tf_to_bool(fvalue);
      this.service.updateCharacteristic('On', value);
      this.Properties.On = value;
    }
    if (property === '20') {
      const value = parseInt(fvalue);
      this.service.updateCharacteristic('Brightness', value);
      this.Properties.Brightness = value;
    }
  }

  getName() {
    return 'Dimmer';
  }

  async setOn(value: CharacteristicValue) {
    const property_full_address = this.address + this.type_to_type.On + '00';
    const fvalue = this.bool_to_tf(value);
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);
    this.Properties.On = value as boolean;

    //this.platform.log.info(`Set Characteristic On (${this.getName()}) ->`, this.Properties.On);
  }

  async getOn(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.On + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.On = this.tf_to_bool(data.fvalue);

    //this.platform.log.info(`Get Characteristic On (${this.getName()}) ->`, this.Properties.On);

    return this.Properties.On;
  }

  async setBrightness(value: CharacteristicValue) {
    const property_full_address = this.address + this.type_to_type.Brightness + '00';
    const fvalue = value;
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);
    this.Properties.Brightness = value as number;

    //this.platform.log.info(`Set Characteristic Brightness (${this.getName()}) ->`, value);
  }

  async getBrightness(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Brightness + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.Brightness = this.stringFloat_to_int(data.fvalue);

    //this.platform.log.info(`Get Characteristic Brightness (${this.getName()}) ->`, this.Properties.Brightness);

    return this.Properties.Brightness;
  }

}

export class WindowCovering extends Device {
  private service: Service;

  private Properties = {
    CurrentPosition: 100,
    PositionState: 2,
    TargetPosition: 100,
  };

  constructor(
    protected readonly platform: AnimaHomeHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.address = accessory.UUID.split('-')[4];
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LLC "Technologico"')
      .setCharacteristic(this.platform.Characteristic.Model, 'Window Covering')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0000-0000-0000-0002');

    this.service = this.accessory.getService(this.platform.Service.WindowCovering)
                || this.accessory.addService(this.platform.Service.WindowCovering);
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/WindowCovering

    this.service.getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .onGet(this.getCurrentPosition.bind(this));  // GET - bind to the 'getCurrentPosition` method below

    this.service.getCharacteristic(this.platform.Characteristic.PositionState)
      .onGet(this.getPositionState.bind(this));    // GET - bind to the 'getPositionState` method below

    this.service.getCharacteristic(this.platform.Characteristic.TargetPosition)
      .onSet(this.setTargetPosition.bind(this))    // SET - bind to the 'setTargetPosition` method below
      .onGet(this.getTargetPosition.bind(this));   // GET - bind to the 'getTargetPosition` method below
  }

  set_value (property_full_address : string, fvalue : string) {
    console.log('Menya vyzvali');
    const property = property_full_address.slice(12, 14);
    if (property === this.type_to_type.Opened) {
      if (fvalue === 'f' && this.Properties.CurrentPosition === 100) {
        this.Properties.CurrentPosition = 0;
        this.Properties.TargetPosition = 0;
        this.Properties.PositionState = 2;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.Properties.CurrentPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.Properties.TargetPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.Properties.PositionState);
      } else if (fvalue === 't' && this.Properties.CurrentPosition === 0) {
        this.Properties.CurrentPosition = 100;
        this.Properties.TargetPosition = 100;
        this.Properties.PositionState = 2;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.Properties.CurrentPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.Properties.TargetPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.Properties.PositionState);
      } else if (fvalue === 'f' && this.Properties.CurrentPosition === 0) {
        this.Properties.CurrentPosition = 0;
        this.Properties.TargetPosition = 0;
        this.Properties.PositionState = 2;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.Properties.CurrentPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.Properties.TargetPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.Properties.PositionState);
      } else if (fvalue === 't' && this.Properties.CurrentPosition === 100) {
        this.Properties.CurrentPosition = 100;
        this.Properties.TargetPosition = 100;
        this.Properties.PositionState = 2;
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, this.Properties.CurrentPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, this.Properties.TargetPosition);
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, this.Properties.PositionState);
      }
    }
  }

  getName() {
    return 'WindowCovering';
  }

  async setTargetPosition(value: CharacteristicValue) {
    const fvalue = this.number_to_position(value as number, this.Properties.CurrentPosition);
    if (fvalue !== undefined) {
      const property_full_address = this.address + this.type_to_type.Opened + '00';
      const request_params : RequestParams = {
        method: 'set_value',
        payload: {
          property_full_address: property_full_address,
          fvalue: fvalue,
        },
      };
      http_request('POST', request_params);
      const dispPercent = this.tf_to_int(fvalue);
      this.Properties.TargetPosition = dispPercent;
      this.Properties.CurrentPosition = dispPercent;
      setTimeout(() => {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetPosition, dispPercent);
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentPosition, dispPercent === 100 ? 100: 1);
        this.service.updateCharacteristic(this.platform.Characteristic.PositionState, dispPercent === 100 ? 2 : 0);
      }, 10);
      //this.platform.log.info(`Set Characteristic Target Position (${this.getName()}) ->`, value);
    }

  }

  async getTargetPosition(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Opened + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.TargetPosition = this.tf_to_int(data.fvalue);

    //this.platform.log.info(`Get Characteristic Target Position (${this.getName()}) ->`, Properties.TargetPosition);

    return this.Properties.TargetPosition;
  }

  async getCurrentPosition(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Opened + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.CurrentPosition = this.tf_to_int(data.fvalue);

    //this.platform.log.info(`Get Characteristic Current Position (${this.getName()}) ->`, this.Properties.CurrentPosition);

    return this.Properties.CurrentPosition;
  }

  async getPositionState(): Promise<CharacteristicValue> {
    //0 - decrease, 1 - increase, 2 - stopped

    //this.platform.log.info(`Get Characteristic Position State (${this.getName()}) ->`, this.Properties.PositionState);

    return this.Properties.PositionState;
  }

}

export class Conditioner extends Device {
  private service: Service;

  private Properties = {
    CurrentHeatingCoolingState: 0,
    TargetHeatingCoolingState: 0,
    CurrentTemperature: 25,
    TargetTemperature: 25,
    TemperatureDisplayUnits: 0,
  };

  constructor(
    protected readonly platform: AnimaHomeHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.address = accessory.UUID.split('-')[4];
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LLC "Technologico"')
      .setCharacteristic(this.platform.Characteristic.Model, 'Conditioner')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0000-0000-0000-0003');

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Thermostat
    this.service = this.accessory.getService(this.platform.Service.Thermostat)
                || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));   // GET - bind to the 'getCurrentHeatingCoolingState` method below

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this))    // SET - bind to the 'setTargetHeatingCoolingState` method below
      .onGet(this.getTargetHeatingCoolingState.bind(this));   // GET - bind to the 'getTargetHeatingCoolingState` method below

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));   // GET - bind to the 'getCurrentTemperature` method below

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this))    // SET - bind to the 'setTargetTemperature` method below
      .onGet(this.getTargetTemperature.bind(this));   // GET - bind to the 'getTargetTemperature` method below

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onSet(this.setTemperatureDisplayUnits.bind(this))    // SET - bind to the 'setTargetTemperature` method below
      .onGet(this.getTemperatureDisplayUnits.bind(this));   // GET - bind to the 'getTargetTemperature` method below
  }

  getName() {
    return 'Conditioner';
  }

  set_value (property_full_address : string, fvalue : string) {
    const property = property_full_address.slice(12, 14);
    if (property === '01') {
      const value = this.tf_to_HCS(fvalue);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, value);
      this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, value);
      this.Properties.CurrentHeatingCoolingState = value;
      this.Properties.TargetHeatingCoolingState = value;
    }
    if (property === '21') {
      const value = this.stringFloat_to_int(fvalue);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, value);
      this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, value);
      this.Properties.CurrentTemperature = value;
      this.Properties.TargetTemperature = value;
    }
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.On + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.CurrentHeatingCoolingState = this.tf_to_HCS(data.fvalue);

    //this.platform.log.info(`Get Characteristic Current Heating Cooling State (${this.getName()}) ->`, this.Properties.CurrentHeatingCoolingState);

    return this.Properties.CurrentHeatingCoolingState;
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.On + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });

    const updateValue = this.tf_to_HCS(data.fvalue);
    this.Properties.TargetHeatingCoolingState = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.Properties.TargetHeatingCoolingState);

    //this.platform.log.info(`Get Characteristic Target Heating Cooling State (${this.getName()}) ->`, this.Properties.TargetHeatingCoolingState);

    return this.Properties.TargetHeatingCoolingState;
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    const property_full_address = this.address + this.type_to_type.On + '00';
    const fvalue = this.HCS_to_tf(value);
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);
    const updateValue = value > 0 ? 2 : 0;
    this.Properties.TargetHeatingCoolingState = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.Properties.TargetHeatingCoolingState);

    this.platform.log.info(`Set Characteristic Target Heating Cooling State (${this.getName()}) -> `, this.Properties.TargetHeatingCoolingState);
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Temperature + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.CurrentTemperature = this.stringFloat_to_int(data.fvalue);
    this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, this.Properties.CurrentTemperature);

    //this.platform.log.info(`Get Characteristic Current Temperature (${this.getName()}) ->`, this.Properties.CurrentTemperature);

    return this.Properties.CurrentTemperature;
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Temperature + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.TargetTemperature = this.stringFloat_to_int(data.fvalue);
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, this.Properties.TargetTemperature);

    //this.platform.log.info(`Get Characteristic Target Temperature (${this.getName()}) ->`, CurrentTemperature);

    return this.Properties.TargetTemperature;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const property_full_address = this.address + this.type_to_type.Temperature + '00';
    const fvalue = value;
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);

    this.Properties.TargetTemperature = value as number;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, value);

    //this.platform.log.info(`Set Characteristic Target Temperature (${this.getName()}) -> `, this.Properties.TargetTemperature);
  }

  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    this.Properties.TemperatureDisplayUnits = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;

    //this.platform.log.info(`Get Characteristic Temperature Display Units (${this.getName()}) ->`, this.Properties.TemperatureDisplayUnits);

    return this.Properties.TemperatureDisplayUnits;
  }

  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    this.Properties.TemperatureDisplayUnits = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;

    //this.platform.log.info(`Set Characteristic Temperature Display Units (${this.getName()}) ->`, this.Properties.TemperatureDisplayUnits);
  }

}

export class WarmFloor extends Device {
  private service: Service;

  private Properties = {
    CurrentHeatingCoolingState: 0,
    TargetHeatingCoolingState: 0,
    CurrentTemperature: 25,
    TargetTemperature: 25,
    TemperatureDisplayUnits: 0,
  };

  constructor(
    protected readonly platform: AnimaHomeHomebridgePlatform,
    protected readonly accessory: PlatformAccessory,
  ) {
    super(platform, accessory);
    this.address = accessory.UUID.split('-')[4];
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'LLC "Technologico"')
      .setCharacteristic(this.platform.Characteristic.Model, 'WarmFloor')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '0000-0000-0000-0004');

    this.service = this.accessory.getService(this.platform.Service.Thermostat)
                || this.accessory.addService(this.platform.Service.Thermostat);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    this.service.getCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState)
      .onGet(this.getCurrentHeatingCoolingState.bind(this));   // GET - bind to the 'getCurrentHeatingCoolingState` method below

    this.service.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
      .onSet(this.setTargetHeatingCoolingState.bind(this))    // SET - bind to the 'setTargetHeatingCoolingState` method below
      .onGet(this.getTargetHeatingCoolingState.bind(this));   // GET - bind to the 'getTargetHeatingCoolingState` method below

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this));   // GET - bind to the 'getCurrentTemperature` method below

    this.service.getCharacteristic(this.platform.Characteristic.TargetTemperature)
      .onSet(this.setTargetTemperature.bind(this))    // SET - bind to the 'setTargetTemperature` method below
      .onGet(this.getTargetTemperature.bind(this));   // GET - bind to the 'getTargetTemperature` method below

    this.service.getCharacteristic(this.platform.Characteristic.TemperatureDisplayUnits)
      .onSet(this.setTemperatureDisplayUnits.bind(this))    // SET - bind to the 'setTargetTemperature` method below
      .onGet(this.getTemperatureDisplayUnits.bind(this));   // GET - bind to the 'getTargetTemperature` method below
  }

  getName() {
    return 'WarmFloor';
  }

  tf_to_HCS(fvalue : string) {
    return fvalue === 't' ? 1 : 0 as number;
  }

  set_value (property_full_address : string, fvalue : string) {
    const property = property_full_address.slice(12, 14);
    if (property === '01') {
      const value = this.tf_to_HCS(fvalue);
      this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, value);
      this.service.updateCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState, value);
      this.Properties.CurrentHeatingCoolingState = value;
      this.Properties.TargetHeatingCoolingState = value;
    }
    if (property === '21') {
      const value = this.stringFloat_to_int(fvalue);
      const index_property = property_full_address.slice(14, 16);
      if (index_property === '00') {
        this.service.updateCharacteristic(this.platform.Characteristic.TargetTemperature, value);
        this.Properties.TargetTemperature = value;
      } else if (index_property === '01') {
        this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, value);
        this.Properties.CurrentTemperature = value;
      }
    }
  }

  async getCurrentHeatingCoolingState(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.On + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.CurrentHeatingCoolingState = this.tf_to_HCS(data.fvalue);

    // this.platform.log.info(`Get Characteristic Current Heating Cooling State (${this.getName()}) ->`, this.Properties.CurrentHeatingCoolingState);

    return this.Properties.CurrentHeatingCoolingState;
  }

  async getTargetHeatingCoolingState(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.On + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });

    const updateValue = this.tf_to_HCS(data.fvalue);
    this.Properties.TargetHeatingCoolingState = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.Properties.TargetHeatingCoolingState);

    // this.platform.log.info(`Get Characteristic Target Heating Cooling State (${this.getName()}) ->`, this.Properties.TargetHeatingCoolingState);

    return this.Properties.TargetHeatingCoolingState;
  }

  async setTargetHeatingCoolingState(value: CharacteristicValue) {
    const property_full_address = this.address + this.type_to_type.On + '00';
    const fvalue = this.HCS_to_tf(value);
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);
    const updateValue = value > 0 ? 1 : 0;
    this.Properties.TargetHeatingCoolingState = updateValue;
    this.service.updateCharacteristic(this.platform.Characteristic.CurrentHeatingCoolingState, this.Properties.TargetHeatingCoolingState);

    // this.platform.log.info(`Set Characteristic Target Heating Cooling State (${this.getName()}) -> `, this.Properties.TargetHeatingCoolingState);
  }

  async getCurrentTemperature(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Temperature + '01';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.CurrentTemperature = this.stringFloat_to_int(data.fvalue);

    // this.platform.log.info(`Get Characteristic Current Temperature (${this.getName()}) ->`, this.Properties.CurrentTemperature);

    return this.Properties.CurrentTemperature;
  }

  async getTargetTemperature(): Promise<CharacteristicValue> {
    const property_address = this.address_slice + this.type_to_type.Temperature + '00';
    const data = await http_request('GET', {
      method: 'value',
      payload: {
        property_address: property_address,
      },
    });
    this.Properties.TargetTemperature = this.stringFloat_to_int(data.fvalue);

    // this.platform.log.info(`Get Characteristic Target Temperature (${this.getName()}) ->`, this.Properties.TargetTemperature);

    return this.Properties.TargetTemperature;
  }

  async setTargetTemperature(value: CharacteristicValue) {
    const property_full_address = this.address + this.type_to_type.Temperature + '00';
    const fvalue = value;
    const request_params : RequestParams = {
      method: 'set_value',
      payload: {
        property_full_address: property_full_address,
        fvalue: fvalue,
      },
    };
    http_request('POST', request_params);

    this.Properties.TargetTemperature = value as number;

    // this.platform.log.info(`Set Characteristic Target Temperature (${this.getName()}) -> `, this.Properties.TargetTemperature);
  }

  async getTemperatureDisplayUnits(): Promise<CharacteristicValue> {
    this.Properties.TemperatureDisplayUnits = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;

    // this.platform.log.info(`Get Characteristic Temperature Display Units (${this.getName()}) ->`, this.Properties.TemperatureDisplayUnits);

    return this.Properties.TemperatureDisplayUnits;
  }

  async setTemperatureDisplayUnits(value: CharacteristicValue) {
    this.Properties.TemperatureDisplayUnits = this.platform.Characteristic.TemperatureDisplayUnits.CELSIUS;

    // this.platform.log.info(`Set Characteristic Temperature Display Units (${this.getName()}) ->`, this.Properties.TemperatureDisplayUnits);
  }

}
