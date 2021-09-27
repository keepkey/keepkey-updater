import React, { Fragment } from 'react';
import DefaultMode from './DefaultMode';
import BootloaderMode from './BootloaderMode';

export default ({ features, initiateUpdate, latest, connecting, updateTitleBar })  => {
  return(
    <Fragment>
      { !features.bootloaderMode &&
        <DefaultMode
          features={features}
          latest={latest}
          initiateUpdate={initiateUpdate}
          connecting={connecting}
          updateTitleBar={updateTitleBar}
        />
      }
      { features.bootloaderMode &&
        <BootloaderMode features={features} latest={latest} initiateUpdate={initiateUpdate} /> }
    </Fragment>
  );
}

