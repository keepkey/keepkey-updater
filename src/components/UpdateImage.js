import React from 'react';
import check from '../images/baseline-check_circle-24px.svg';
import close from '../images/baseline-close-24px.svg';

export default (props) => {
  const src = props.status ? check : close;
  return(
    <img src={src} />
  );
}
