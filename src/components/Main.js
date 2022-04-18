import React, { Component } from 'react';
import NoDevice from './NoDevice';
import Device from './Device';
import Loading from './Loading';
import AxiomUpdate from './AxiomUpdate';
import FoxLogo from '../images/fox-logo.svg';

const { ipcRenderer } = window.require('electron');

const appHeaderStyles = {
  textAlign: 'center',
  textTransform: 'uppercase',
  paddingTop: 20,
};

const appTitleStyles = {
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: 2
}

const imageStyles = {
  display: 'block',
  margin: 'auto',
  marginTop: 20
}

const appVersionStyles = {
  display: 'block',
  position: 'absolute',
  right: 0,
  bottom: 0,
  padding: '5px 10px',
  opacity: '40%',
}

export default class Main extends Component {
  constructor(props) {
    super(props);
    this.state = {
      connecting: true,
      features: null,
      updating: false,
      start: null,
      latest: null,
      error: null,
      title: 'KeepKey Updater',
      progress: 0,
      appVersion: null,
    }
    this.updateFeatures = this.updateFeatures.bind(this);
    this.updateConnecting = this.updateConnecting.bind(this);
    this.initiateUpdate = this.initiateUpdate.bind(this);
    this.uncaughtException = this.uncaughtException.bind(this);
    this.handleLatest = this.handleLatest.bind(this);
    this.handleError = this.handleError.bind(this);
    this.updateTitleBar = this.updateTitleBar.bind(this);
    this.handleAppVersion = this.handleAppVersion.bind(this);
  }

  updateFeatures(event, message) {
    this.setState({ features: message });
  }

  updateConnecting(event, message) {
    this.setState({ connecting: message });
  }

  handleLatest(event, message) {
    this.setState({ latest: message })
  }

  handleAppVersion(event, message) {
    this.setState({ appVersion: message })
  }

  updateTitleBar(update) {
    const { title, progress } = update
    if (title && title !== this.state.title) this.setState({ title })
    if (Number.isInteger(progress) && progress !== this.state.progress) this.setState({ progress })
  }

  uncaughtException(event, message) {
    this.setState({
      connecting: false,
      features: null,
      updating: false,
      start: null,
    });
  }

  initiateUpdate(start) {
    this.setState({ start, updating: true });
  }

  handleError(event, message) {
    this.setState({ error: message })
  }

  contactSupport = (e) => {
    e.preventDefault();
    ipcRenderer.send('get-help')
  }

  progressBar() {
    const styles = {
      height: 3,
      backgroundColor: '#7b8ba0',
      marginTop: 20,
    }
    const { progress } = this.state
    return(
      <div style={styles}>
        <div style={{ height: 3, backgroundColor: '#66bb6a',  width: `${progress}%` }} />
      </div>
    )
  }

  componentDidMount() {
    ipcRenderer.send('app-start');
    ipcRenderer.on('features', this.updateFeatures);
    ipcRenderer.on('connecting', this.updateConnecting);
    ipcRenderer.on('uncaught-exception', this.uncaughtException);
    ipcRenderer.on('latest', this.handleLatest);
    ipcRenderer.on('error', this.handleError);
    ipcRenderer.on('app-version', this.handleAppVersion);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('features', this.updateFeatures);
    ipcRenderer.removeListener('connecting', this.updateConnecting);
  }

  render() {
    const { error, features, connecting, updating, start, latest, title, appVersion } = this.state;

    if(updating) {
      return(
        <div>
          <div style={appHeaderStyles}>
            <h4 style={appTitleStyles}>{ title }</h4>
          </div>
          { this.progressBar() }
          <img style={imageStyles} src={FoxLogo} alt="fox" />
          <AxiomUpdate
            updateTitleBar={this.updateTitleBar}
            start={start}
            features={features}
            latest={latest}
            cancel={() => this.setState({ updating: false, title: 'KeepKey Updater', progress: 0 })}
          />
        </div>
      );
    }

    if(!!error && !(features && features.bootloaderMode)) {
      return(
        <div style={{textAlign: 'center', marginTop: 100, fontWeight: 600}}>
          <p>
            Something went wrong when trying to fetch firmware data.
            Please check your internet connnection and try again.
          </p>
          <p>{ error }</p>
          <p>
            If you continue to see this message,
            please <a style={{ cursor: 'pointer' }} onClick={this.contactSupport}>contact support</a>.
          </p>
        </div>
      );
    }

    return (
      <div>
        <div style={appHeaderStyles}>
          <h4 style={appTitleStyles}>{ title }</h4>
          { this.progressBar() }
        </div>
        <img style={imageStyles} src={FoxLogo} alt="fox" />
        { (connecting || !latest) &&
          <Loading>{!latest ? 'Fetching Firmware Data' : 'Getting Device Info'}</Loading>
          }
        { (!connecting && !features) &&
          <NoDevice updateTitleBar={this.updateTitleBar} />
          }
        { (!!features && !!latest) &&
          <Device
            initiateUpdate={this.initiateUpdate}
            updateTitleBar={this.updateTitleBar}
            features={features}
            latest={latest}
            connecting={connecting}
          />
          }
        { !!appVersion && <div style={appVersionStyles}>{appVersion}</div> }
      </div>
    );
  }
}
