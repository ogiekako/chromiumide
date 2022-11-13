// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import {
  Box,
  Button,
  Container,
  FormGroup,
  FormLabel,
  Grid,
  LinearProgress,
  Radio,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import * as React from 'react';
import CheckIcon from '@mui/icons-material/Check';
import SentimentDissatisfiedIcon from '@mui/icons-material/SentimentDissatisfied';
import * as colors from '@mui/material/colors';
import * as model from '../../../../src/features/chromiumos/device_management/flash/flash_device_model';
import * as ReactPanelHelper from '../../react/common/react_panel_helper';

const vscodeApi = acquireVsCodeApi();

ReactPanelHelper.receiveInitialData<model.FlashDeviceViewState>(vscodeApi).then(
  state => {
    ReactPanelHelper.createAndRenderRoot(<FlashDeviceView state={state} />);
  }
);

const containerStyle = {
  minHeight: '24em',
  maxWidth: '70em',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export function FlashDeviceView(props: {state: model.FlashDeviceViewState}) {
  const [state, setState] = React.useState(props.state);

  const handleStateChange = (newState: model.FlashDeviceViewState) => {
    setState(newState);
  };

  return <Container>{StepContents(state, handleStateChange)}</Container>;
}

function StepContents(
  state: model.FlashDeviceViewState,
  handleStateChange: (newState: model.FlashDeviceViewState) => void
) {
  switch (state.step) {
    case model.FlashDeviceStep.HIGH_LEVEL_BUILD_SELECTION:
      return (
        <HighLevelBuildSelectionStep
          state={state}
          setState={handleStateChange}
        />
      );
    case model.FlashDeviceStep.BUILD_BROWSER:
      return <p>Build browser not yet implemented.</p>;
    case model.FlashDeviceStep.FLASH_CONFIRMATION:
      return (
        <FlashConfirmationStep state={state} setState={handleStateChange} />
      );
    case model.FlashDeviceStep.FLASH_PROGRESS:
      return <FlashProgress state={state} setState={handleStateChange} />;
  }
}

function HighLevelBuildSelectionStep(props: {
  state: model.FlashDeviceViewState;
  setState: (newState: model.FlashDeviceViewState) => void;
}) {
  const handleBuildSelectionType = (v: model.BuildSelectionType) => {
    props.setState({...props.state, buildSelectionType: v});
  };
  const handleBuildSelectionTypeRadio = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    handleBuildSelectionType(Number(event.target.value));
  };
  const handleBuildChannel = (v: model.BuildChannel) => {
    props.setState({...props.state, buildChannel: v});
  };
  const handleNext = () => {
    if (
      props.state.buildSelectionType ===
      model.BuildSelectionType.LATEST_OF_CHANNEL
    ) {
      props.setState({
        ...props.state,
        step: model.FlashDeviceStep.FLASH_CONFIRMATION,
      });
    } else {
      props.setState({
        ...props.state,
        step: model.FlashDeviceStep.BUILD_BROWSER,
      });
    }
  };
  const handleCancel = () => {
    vscodeApi.postMessage({command: 'close'});
  };
  const handleKeydown = (e: any) => {
    if (e.key === 'c') {
      handleBuildChannel(model.BuildChannel.CANARY);
    } else if (e.key === 'd') {
      handleBuildChannel(model.BuildChannel.DEV);
    } else if (e.key === 'b') {
      handleBuildChannel(model.BuildChannel.BETA);
    } else if (e.key === 's') {
      handleBuildChannel(model.BuildChannel.STABLE);
    } else if (e.key === 'l') {
      handleBuildSelectionType(model.BuildSelectionType.LATEST_OF_CHANNEL);
    } else if (e.key === 'f') {
      handleBuildSelectionType(model.BuildSelectionType.SPECIFIC_BUILD);
    } else if (e.key === 'Enter') {
      handleNext();
    } else if (e.key === 'Esc') {
      handleCancel();
    }
  };

  return (
    <div
      tabIndex={-1}
      onKeyDown={handleKeydown}
      ref={elem => elem?.focus()}
      style={containerStyle}
    >
      <Stack spacing={2}>
        <FormGroup>
          {/* We have to use a grid with radios in separate cell from their contents,
          since Mui does not support controls inside of the radio or its label, and
          we have a toggle group with Latest of <channel>. We therefore must also
          manually handle the radio group value and selection.*/}
          <Grid container spacing={2}>
            <Grid container item xs={12}>
              <Grid item xs="auto">
                <Radio
                  value={model.BuildSelectionType.LATEST_OF_CHANNEL}
                  checked={
                    props.state.buildSelectionType ===
                    model.BuildSelectionType.LATEST_OF_CHANNEL
                  }
                  onChange={handleBuildSelectionTypeRadio}
                />
              </Grid>
              <Grid item xs>
                <FormLabel>
                  <u>L</u>atest
                </FormLabel>

                <ToggleButtonGroup
                  exclusive
                  value={props.state.buildChannel}
                  onChange={(_e, v) => {
                    if (v !== null) {
                      handleBuildChannel(v);
                    }
                  }}
                >
                  <ToggleButton
                    value={model.BuildChannel.CANARY}
                    title="The very latest build of all"
                  >
                    <u>C</u>anary
                  </ToggleButton>
                  <ToggleButton value={model.BuildChannel.DEV}>
                    <u>D</u>ev
                  </ToggleButton>
                  <ToggleButton value={model.BuildChannel.BETA}>
                    <u>B</u>eta
                  </ToggleButton>
                  <ToggleButton value={model.BuildChannel.STABLE}>
                    <u>S</u>table
                  </ToggleButton>
                </ToggleButtonGroup>
              </Grid>
            </Grid>
            <Grid container item xs={12}>
              <Grid item xs="auto">
                <Radio
                  value={model.BuildSelectionType.SPECIFIC_BUILD}
                  checked={
                    props.state.buildSelectionType ===
                    model.BuildSelectionType.SPECIFIC_BUILD
                  }
                  onChange={handleBuildSelectionTypeRadio}
                />
              </Grid>
              <Grid item xs style={{verticalAlign: 'center'}}>
                <FormLabel>
                  <u>F</u>ind a specific build...
                </FormLabel>
              </Grid>
            </Grid>
          </Grid>
        </FormGroup>

        <Box sx={{display: 'flex', flexDirection: 'row', pt: 2}}>
          <Button variant="outlined" onClick={handleCancel} sx={{mr: 1}}>
            Cancel
          </Button>
          <Box sx={{flex: '1 1 auto'}} />
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        </Box>
      </Stack>
    </div>
  );
}

function FlashConfirmationStep(props: {
  state: model.FlashDeviceViewState;
  setState: (newState: model.FlashDeviceViewState) => void;
}) {
  const handleFlash = () => {
    vscodeApi.postMessage({command: 'flash', state: props.state});
    props.setState({
      ...props.state,
      step: model.FlashDeviceStep.FLASH_PROGRESS,
    });
  };
  const handleBack = () => {
    if (
      props.state.buildSelectionType ===
      model.BuildSelectionType.LATEST_OF_CHANNEL
    ) {
      props.setState({
        ...props.state,
        step: model.FlashDeviceStep.HIGH_LEVEL_BUILD_SELECTION,
      });
    } else {
      props.setState({
        ...props.state,
        step: model.FlashDeviceStep.BUILD_BROWSER,
      });
    }
  };

  const handleKeydown = (e: any) => {
    if (e.key === 'Enter') {
      handleFlash();
    } else if (e.key === 'Esc') {
      handleBack();
    }
  };

  const buildVersionInfo =
    props.state.buildSelectionType ===
    model.BuildSelectionType.LATEST_OF_CHANNEL ? (
      <>
        <Grid item xs={4}>
          <b>Version:</b>
        </Grid>
        <Grid item xs={8}>
          (Latest)
        </Grid>
      </>
    ) : (
      <>
        <Grid item xs={4}>
          <b>Chrome OS:</b>
        </Grid>
        <Grid item xs={8}>
          {props.state.buildInfo?.chromeOsVersion}
        </Grid>
        <Grid item xs={4}>
          <b>Chrome:</b>
        </Grid>
        <Grid item xs={8}>
          {props.state.buildInfo?.chromeVersion}
        </Grid>
        <Grid item xs={4}>
          <b>ARC:</b>
        </Grid>
        <Grid item xs={8}>
          {props.state.buildInfo?.arcVersion}
        </Grid>
      </>
    );

  return (
    <div
      tabIndex={-1}
      onKeyDown={handleKeydown}
      ref={elem => elem?.focus()}
      style={containerStyle}
    >
      <Stack spacing={2}>
        <p>
          Continuing will flash{' '}
          <b>
            "{props.state.hostname}" ({props.state.board})
          </b>{' '}
          with build:
        </p>

        <Grid container>
          <Grid item xs={4}>
            <b>Channel:</b>
          </Grid>
          <Grid item xs={8}>
            {props.state.buildChannel}
          </Grid>
          {buildVersionInfo}
        </Grid>

        <Box sx={{display: 'flex', flexDirection: 'row', pt: 2}}>
          <Button onClick={handleBack} sx={{mr: 1}}>
            Back
          </Button>
          <Box sx={{flex: '1 1 auto'}} />
          <Button variant="contained" color="error" onClick={handleFlash}>
            Flash Now
          </Button>
        </Box>
      </Stack>
    </div>
  );
}

function FlashProgress(props: {
  state: model.FlashDeviceViewState;
  setState: (newState: model.FlashDeviceViewState) => void;
}) {
  React.useEffect(() => {
    window.addEventListener('message', event => {
      const message = event.data as model.FlashDevicePanelMessage;
      console.log('Received message: ' + JSON.stringify(message));
      switch (message.command) {
        case 'flashProgressUpdate':
          props.setState({
            ...props.state,
            flashProgress: message.progress,
          });
          break;
        case 'flashComplete':
          props.setState({...props.state, flashingComplete: true});
          break;
        case 'flashError':
          props.setState({...props.state, flashError: message.errorMessage});
      }
    });
  }, []); // [] causes this to be run only once, after the first render

  if (props.state.flashError) {
    return (
      <Stack style={containerStyle}>
        <h2>Error while Flashing</h2>
        <SentimentDissatisfiedIcon sx={{color: colors.red[500]}} />
      </Stack>
    );
  } else if (!props.state.flashingComplete) {
    return (
      <div style={containerStyle}>
        <Stack spacing={2}>
          <h2>Flashing...</h2>
          <LinearProgress
            variant={
              props.state.flashProgress > 0.0 ? 'determinate' : 'indeterminate'
            }
            value={props.state.flashProgress}
            sx={{maxWidth: '70em', minWidth: '32em'}}
          />
        </Stack>
      </div>
    );
  } else {
    return (
      <Stack style={containerStyle}>
        <h2>Success!</h2>
        <CheckIcon sx={{color: colors.green[500]}} />
      </Stack>
    );
  }
}
