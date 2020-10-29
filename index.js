import React, { Component } from 'react';
import {
    NativeModules,
    PanResponder,
    Dimensions,
    Image,
    View,
    Animated,
    StyleSheet,
} from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const AnimatedPolygon = Animated.createAnimatedComponent(Polygon);

class CustomCrop extends Component {
    static defaultProps = {
        overlayOpacity: 0.5,
        overlayColor: 'blue',
        overlayStrokeColor: 'blue',
        overlayStrokeWidth: 3,
    }

    constructor(props) {
        super(props);
        this.state = {
            viewWidth: this.viewWidth(),
            viewHeight: this.viewHeight(),
            moving: false,
        };

        this.state = {
            ...this.state,
            topLeft: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? props.rectangleCoordinates.topLeft
                    : { x: 100, y: 100 },
            ),
            topRight: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? props.rectangleCoordinates.topRight
                    : { x: Dimensions.get('window').width - 100, y: 100 },
            ),
            bottomLeft: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? props.rectangleCoordinates.bottomLeft
                    : { x: 100, y: this.state.viewHeight - 100 },
            ),
            bottomRight: new Animated.ValueXY(
                props.rectangleCoordinates
                    ? props.rectangleCoordinates.bottomRight
                    : {
                          x: Dimensions.get('window').width - 100,
                          y: this.state.viewHeight - 100,
                      },
            ),
        };
        this.state = {
            ...this.state,
            overlayPositions: `${this.state.topLeft.x._value},${
                this.state.topLeft.y._value
            } ${this.state.topRight.x._value},${this.state.topRight.y._value} ${
                this.state.bottomRight.x._value
            },${this.state.bottomRight.y._value} ${
                this.state.bottomLeft.x._value
            },${this.state.bottomLeft.y._value}`,
        };

        this.panResponderTopLeft = this.createPanResponser(this.state.topLeft);
        this.panResponderTopRight = this.createPanResponser(
            this.state.topRight,
        );
        this.panResponderBottomLeft = this.createPanResponser(
            this.state.bottomLeft,
        );
        this.panResponderBottomRight = this.createPanResponser(
            this.state.bottomRight,
        );
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.height !== this.props.height) {
            this.setState({
                viewHeight: this.viewHeight(),
                viewWidth: this.viewWidth(),
                height: this.props.height,
                width: this.props.width
            })
        }
    }

    createPanResponser(corner) {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderMove: (evt, gestureState) => {
                Animated.event([
                    null,
                    {
                        dx: corner.x,
                        dy: corner.y,
                    },
                ], { useNativeDriver: false })(evt, gestureState);
                this.updateOverlayString();
            },
            onPanResponderRelease: () => {
                corner.flattenOffset();
                this.updateOverlayString();
            },
            onPanResponderGrant: () => {
                corner.setOffset({ x: corner.x._value, y: corner.y._value });
                corner.setValue({ x: 0, y: 0 });
            },
        });
    }

    crop() {
        const coordinates = {
            topLeft: this.topLeft(),
            topRight: this.topRight(),
            bottomLeft: this.bottomLeft(),
            bottomRight: this.bottomRight(),
            height: this.props.height,
            width: this.props.width,
        };
        NativeModules.CustomCropManager.crop(
            coordinates,
            this.props.image,
            (err, res) => this.props.updateImage(res.image, coordinates),
        );
    }

    updateOverlayString() {
        let topLeftx = this.state.topLeft.x._value  this.state.topLeft.x._offset;
        let topLefty = this.state.topLeft.y._value  this.state.topLeft.y._offset;

        let topRightx = this.state.topRight.x._value  this.state.topRight.x._offset;
        let topRighty = this.state.topRight.y._value  this.state.topRight.y._offset;

        let bottomRightx = this.state.bottomRight.x._value  this.state.bottomRight.x._offset;
        let bottomRighty = this.state.bottomRight.y._value  this.state.bottomRight.y._offset;

        let bottomLeftx = this.state.bottomLeft.x._value  this.state.bottomLeft.x._offset;
        let bottomLefty = this.state.bottomLeft.y._value  this.state.bottomLeft.y._offset;
        
        this.setState({
            overlayPositions: `${topLeftx},${topLefty} ${topRightx},${topRighty} ${bottomRightx},${bottomRighty} ${bottomLeftx},${bottomLefty}`,
        });
    }

    imageCoordinatesToViewCoordinates(corner) {
        return {
            x: (corner.x * Dimensions.get('window').width) / this.props.width,
            y: (corner.y * this.state.viewHeight) / this.props.height,
        };
    }

    viewCoordinatesToImageCoordinates(corner) {
        return {
            x: (corner.x._value / Dimensions.get('window').width) * this.props.width,
            y: (corner.y._value / this.state.viewHeight) * this.props.height,
        };
    }

    viewHeight() {
        const calculatedHeight = width * (this.props.height / this.props.width);
        const h = calculatedHeight > height ? calculatedHeight : height;
        return h;
    }

    viewWidth() {
        const calculatedWidth = height * (this.props.width / this.props.height);
        const w = calculatedWidth > width ? calculatedWidth : width;
        return w;
    }

    topLeft() {
        const x = this.state.topLeft.x._value;
        const y = this.state.topLeft.y._value;
        const topLeftX = x  (this.state.viewWidth / 2 - width / 2);
        const viewTopY = height / 2 - this.state.viewHeight / 2;
        const topY = Math.max(y - viewTopY, 0);
        return {
            x: ( topLeftX * this.props.width ) / this.state.viewWidth,
            y: ( topY * this.props.height ) / this.state.viewHeight,
        }
    }

    topRight() {
        const x = this.state.topRight.x._value;
        const y = this.state.topRight.y._value;
        const topX = x  (this.state.viewWidth / 2 - width / 2);
        const viewTopY = height / 2 - this.state.viewHeight / 2;
        const topY = Math.max(y - viewTopY, 0);
        return {
            x: ( topX * this.props.width ) / this.state.viewWidth,
            y: ( topY * this.props.height ) / this.state.viewHeight,
        }
    }

    bottomLeft() {
        const x = this.state.bottomLeft.x._value;
        const y = this.state.bottomLeft.y._value;
        const bottomX = x  (this.state.viewWidth / 2 - width / 2);
        const viewBottomY = height / 2  this.state.viewHeight / 2;
        const bottomY = Math.min(Math.min(viewBottomY, y) - (viewBottomY - this.state.viewHeight), this.state.viewHeight);
        return {
            x: ( bottomX * this.props.width ) / this.state.viewWidth,
            y: ( bottomY * this.props.height ) / this.state.viewHeight,
        }
    }

    bottomRight() {
        const x = this.state.bottomRight.x._value;
        const y = this.state.bottomRight.y._value;
        const bottomX = x  (this.state.viewWidth / 2 - width / 2);
        const viewBottomY = height / 2  this.state.viewHeight / 2;
        const bottomY = Math.min(Math.min(viewBottomY, y) - (viewBottomY - this.state.viewHeight), this.state.viewHeight);
        return {
            x: ( bottomX * this.props.width ) / this.state.viewWidth,
            y: ( bottomY * this.props.height ) / this.state.viewHeight,
        }
    }
        
    render() {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                }}
            >
                <View
                    style={[
                        s(this.props).cropContainer,
                    ]}
                >
                    {!!this.props.image && (
                        <Image
                            style={[
                                s(this.props).image,
                            ]}
                            resizeMode="cover"
                            source={{ uri: this.props.image }}
                        />
                    )}
                    <Svg
                        height={Dimensions.get('window').height}
                        width={Dimensions.get('window').width}
                        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, right: 0 }}
                    >
                        <AnimatedPolygon
                            ref={(ref) => (this.polygon = ref)}
                            fill={this.props.overlayColor}
                            fillOpacity={this.props.overlayOpacity}
                            stroke={this.props.overlayStrokeColor}
                            points={this.state.overlayPositions}
                            strokeWidth={this.props.overlayStrokeWidth}
                        />
                    </Svg>
                    <Animated.View
                        {...this.panResponderTopLeft.panHandlers}
                        style={[
                            this.state.topLeft.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        {this.props.renderHandler && this.props.renderHandler()}
                        {!this.props.renderHandler && (
                            <>
                                <View
                                    style={[
                                        s(this.props).handlerI,
                                        { left: -10, top: -10 },
                                    ]}
                                />
                                <View
                                    style={[
                                        s(this.props).handlerRound,
                                        { left: 31, top: 31 },
                                    ]}
                                />
                            </>
                        )}
                    </Animated.View>
                    <Animated.View
                        {...this.panResponderTopRight.panHandlers}
                        style={[
                            this.state.topRight.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        {this.props.renderHandler && this.props.renderHandler()}
                        {!this.props.renderHandler && (
                            <>
                                <View
                                    style={[
                                        s(this.props).handlerI,
                                        { left: 10, top: -10 },
                                    ]}
                                />
                                <View
                                    style={[
                                        s(this.props).handlerRound,
                                        { right: 31, top: 31 },
                                    ]}
                                />
                            </>
                        )}
                    </Animated.View>
                    <Animated.View
                        {...this.panResponderBottomLeft.panHandlers}
                        style={[
                            this.state.bottomLeft.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        {this.props.renderHandler && this.props.renderHandler()}
                        {!this.props.renderHandler && (
                            <>
                                <View
                                    style={[
                                        s(this.props).handlerI,
                                        { left: -10, top: 10 },
                                    ]}
                                />
                                <View
                                    style={[
                                        s(this.props).handlerRound,
                                        { left: 31, bottom: 31 },
                                    ]}
                                />
                            </>
                        )}
                    </Animated.View>
                    <Animated.View
                        {...this.panResponderBottomRight.panHandlers}
                        style={[
                            this.state.bottomRight.getLayout(),
                            s(this.props).handler,
                        ]}
                    >
                        {this.props.renderHandler && this.props.renderHandler()}
                        {!this.props.renderHandler && (
                            <>
                                <View
                                    style={[
                                        s(this.props).handlerI,
                                        { left: 10, top: 10 },
                                    ]}
                                />
                                <View
                                    style={[
                                        s(this.props).handlerRound,
                                        { right: 31, bottom: 31 },
                                    ]}
                                />
                            </>
                        )}
                    </Animated.View>
                </View>
            </View>
        );
    }
}

const s = (props) => ({
    handlerI: {
        borderRadius: 0,
        height: 20,
        width: 20,
        backgroundColor: props.handlerColor || 'blue',
    },
    handlerRound: {
        width: 39,
        position: 'absolute',
        height: 39,
        borderRadius: 100,
        backgroundColor: props.handlerColor || 'blue',
    },
    image: {
        ...StyleSheet.absoluteFillObject,
    },
    bottomButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'blue',
        width: 70,
        height: 70,
        borderRadius: 100,
    },
    handler: {
        height: 140,
        width: 140,
        overflow: 'visible',
        marginLeft: -70,
        marginTop: -70,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'absolute',
    },
    cropContainer: {
        ...StyleSheet.absoluteFillObject,
    },
});

export default CustomCrop;
