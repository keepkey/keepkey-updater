import React, { Fragment } from 'react';
import kkImg from '../images/keepkey-placeholder.png';

export default (props) => {
  const { features } = props;
  return(
    <Fragment>
      <h2>{features.label}</h2>
      <img src={kkImg} alt="keepkey device" style={{ width: 100, marginBottom: 20 }} />
      <span>Current Firmare Version: {features.version}</span>
      <span>Latest Firware Version: {features.available_firmware_version}</span>
      <span>Bootloader Version: {features.bootloaderInfo.tag}</span>
      <span>Bootlader Upgradable: {features.bootloaderInfo.upgradable.toString()}</span>
    </Fragment>
  );
};
