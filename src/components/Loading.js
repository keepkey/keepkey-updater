import React from 'react';
import { Loader } from 'semantic-ui-react'

export default ({ children }) => {
  return(
    <div style={loadingContainerStyles}>
      <Loader active={true} size="massive" />
      { children }
    </div>
  );
};

const loadingContainerStyles = {
  display: 'flex',
  flexDirection: 'column',
  height: 400,
  alignItems: 'center',
  justifyContent: 'center'
}

