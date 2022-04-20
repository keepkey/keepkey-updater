import React, { Fragment } from 'react';
import DefaultMode from './DefaultMode';
import BootloaderMode from './BootloaderMode';

export default ({ features, initiateUpdate, firmwareData, connecting, updateTitleBar })  => {
  return(
    <Fragment>
      { !features.bootloaderMode &&
        <DefaultMode
          features={features}
          firmwareData={firmwareData}
          initiateUpdate={initiateUpdate}
          connecting={connecting}
          updateTitleBar={updateTitleBar}
        />
      }
      { features.bootloaderMode &&
        <BootloaderMode features={features} firmwareData={firmwareData} initiateUpdate={initiateUpdate} /> }
    </Fragment>
  );
}

