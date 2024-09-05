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
        let finalWidth = width;
        let finalHeight = height;
        const iAspectRatio = this.props.width / this.props.height;
        const sAspectRatio = width / height;
        if (iAspectRatio > sAspectRatio) {
            finalHeight = (this.props.height * width) / this.props.width;
        } else {
            finalWidth = (this.props.width * height) / this.props.height;
        }

        this.state = {
            viewWidth: finalWidth,
            viewHeight: finalHeight,
            moving: false,
        };
        NativeModules.CustomCropManager
            .detectRectangleForImage(this.props.image)
            .then(result => {
                const { topLeft, topRight, bottomLeft, bottomRight } = result;
                this.initRectangle({
                    topLeft: this.translateImageCoordToViewCoord(topLeft),
                    topRight: this.translateImageCoordToViewCoord(topRight),
                    bottomLeft: this.translateImageCoordToViewCoord(bottomLeft),
                    bottomRight: this.translateImageCoordToViewCoord(bottomRight),
                })
            })
            .catch(error => {
                const {viewHeight, viewWidth} = this.state;
                this.initRectangle({
                    topLeft: { x: 50, y: 50 },
                    topRight: { x: viewWidth - 50, y: 50 },
                    bottomRight: { x: viewWidth - 50, y: viewHeight - 50 },
                    bottomLeft: { x: 50, y: viewHeight - 50 },
                })
            })
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevProps.height !== this.props.height) {
            let finalWidth = width;
            let finalHeight = height;
            const iAspectRatio = this.props.width / this.props.height;
            const sAspectRatio = width / height;
            if (iAspectRatio > sAspectRatio) {
                finalHeight = (this.props.height * width) / this.props.width;
            } else {
                finalWidth = (this.props.width * height) / this.props.height;
            }
            this.setState({
                viewHeight: finalHeight,
                viewWidth: finalWidth,
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
            topLeft: this.translateViewCoordToImageCoord(this.state.topLeft),
            topRight: this.translateViewCoordToImageCoord(this.state.topRight),
            bottomLeft: this.translateViewCoordToImageCoord(this.state.bottomLeft),
            bottomRight: this.translateViewCoordToImageCoord(this.state.bottomRight),
            height: this.props.height,
            width: this.props.width,
        };
        NativeModules.CustomCropManager.crop(
            coordinates,
            this.props.image,
            (err, res) => this.props.updateImage(res.image, coordinates),
        );
    }

    initRectangle(data) {
        console.log({data});
        const { topLeft, topRight, bottomLeft, bottomRight } = data;
        const aTopLeft = new Animated.ValueXY(topLeft);
        const aTopRight = new Animated.ValueXY(topRight);
        const aBottomLeft = new Animated.ValueXY(bottomLeft);
        const aBottomRight = new Animated.ValueXY(bottomRight);
        this.panResponderTopLeft = this.createPanResponser(aTopLeft);
        this.panResponderTopRight = this.createPanResponser(aTopRight);
        this.panResponderBottomLeft = this.createPanResponser(aBottomLeft);
        this.panResponderBottomRight = this.createPanResponser(aBottomRight);
        this.setState({
            topLeft: aTopLeft,
            topRight: aTopRight,
            bottomLeft: aBottomLeft,
            bottomRight: aBottomRight,
        });
        this.updateOverlayString();
    }

    updateOverlayString() {
        let topLeftx = this.state.topLeft.x._value + this.state.topLeft.x._offset;
        let topLefty = this.state.topLeft.y._value + this.state.topLeft.y._offset;

        let topRightx = this.state.topRight.x._value + this.state.topRight.x._offset;
        let topRighty = this.state.topRight.y._value + this.state.topRight.y._offset;

        let bottomRightx = this.state.bottomRight.x._value + this.state.bottomRight.x._offset;
        let bottomRighty = this.state.bottomRight.y._value + this.state.bottomRight.y._offset;

        let bottomLeftx = this.state.bottomLeft.x._value + this.state.bottomLeft.x._offset;
        let bottomLefty = this.state.bottomLeft.y._value + this.state.bottomLeft.y._offset;
        
        this.setState({
            overlayPositions: `${topLeftx},${topLefty} ${topRightx},${topRighty} ${bottomRightx},${bottomRighty} ${bottomLeftx},${bottomLefty}`,
        });
    }

    translateViewCoordToImageCoord(point) {
        const x = point.x._value;
        const y = point.y._value;
        return {
            x: x * this.props.width / this.state.viewWidth,
            y: y * this.props.height / this.state.viewHeight,
        }
    }

    translateImageCoordToViewCoord(point) {
        return {
            x: point.x * this.state.viewWidth / this.props.width,
            y: point.y * this.state.viewHeight / this.props.height,
        }
    }
        
    render() {
        return (
            <View
                style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'black'
                }}
            >
                <View
                    style={[
                        s(this.props).cropContainer,
                        {
                            width: this.state.viewWidth,
                            height: this.state.viewHeight,
                        }
                    ]}
                >
                    {!!this.props.image && (
                        <Image
                            style={[
                                s(this.props).image,
                            ]}
                            resizeMode="contain"
                            source={{ uri: this.props.image }}
                        />
                    )}
                    <Svg
                        height={this.state.viewHeight}
                        width={this.state.viewWidth}
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
                    {this.state.topLeft && <Animated.View
                        {...this.panResponderTopLeft?.panHandlers}
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
                    </Animated.View>}
                    {this.state.topRight && <Animated.View
                        {...this.panResponderTopRight?.panHandlers}
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
                    </Animated.View>}
                    {this.state.bottomLeft && <Animated.View
                        {...this.panResponderBottomLeft?.panHandlers}
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
                    </Animated.View>}
                    {this.state.bottomRight && <Animated.View
                        {...this.panResponderBottomRight?.panHandlers}
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
                    </Animated.View>}
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
        // ...StyleSheet.absoluteFillObject,
    },
});

export default CustomCrop;
