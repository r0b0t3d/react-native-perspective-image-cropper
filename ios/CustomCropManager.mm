#import "CustomCropManager.h"
#import <React/RCTLog.h>

@implementation CustomCropManager
{
  dispatch_queue_t _rectangleDetectionQueue;
}

-(instancetype)init {
  self = [super init];
  _rectangleDetectionQueue = dispatch_queue_create("RectangleDetectionQueue", NULL);
  return self;
}

+(BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(detectRectangleForImage:(NSString *)imageUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *parsedImageUri = [imageUri stringByReplacingOccurrencesOfString:@"file://" withString:@""];
  NSURL *fileURL = [NSURL fileURLWithPath:parsedImageUri];
  UIImage *iimage = [[UIImage new] initWithData:[NSData dataWithContentsOfURL:fileURL]];
  CIImage *ciImage = [CIImage imageWithCGImage:[self fixOrientation:iimage].CGImage];
  [self detectRectangleFromImage:ciImage completion:^(NSDictionary *coordinates) {
    if (coordinates != nil) {
      resolve(coordinates);
    } else {
      reject(@"", @"Not found", nil);
    }
  }];
}

RCT_EXPORT_METHOD(crop:(NSDictionary *)points
                  imageUri:(NSString *)imageUri
                  callback:(RCTResponseSenderBlock)callback)
{
    NSString *parsedImageUri = [imageUri stringByReplacingOccurrencesOfString:@"file://" withString:@""];
    NSURL *fileURL = [NSURL fileURLWithPath:parsedImageUri];
    UIImage *iimage = [[UIImage new] initWithData:[NSData dataWithContentsOfURL:fileURL]];
    CIImage *ciImage = [CIImage imageWithCGImage:[self fixOrientation:iimage].CGImage];
//    CIImage *ciImage = [CIImage imageWithContentsOfURL:fileURL];
     
    float height = [points[@"height"] floatValue];    
    CGPoint newLeft = CGPointMake([points[@"topLeft"][@"x"] floatValue], [points[@"topLeft"][@"y"] floatValue]);
    CGPoint newRight = CGPointMake([points[@"topRight"][@"x"] floatValue], [points[@"topRight"][@"y"] floatValue]);
    CGPoint newBottomLeft = CGPointMake([points[@"bottomLeft"][@"x"] floatValue], [points[@"bottomLeft"][@"y"] floatValue]);
    CGPoint newBottomRight = CGPointMake([points[@"bottomRight"][@"x"] floatValue], [points[@"bottomRight"][@"y"] floatValue]);
    
    newLeft = [self cartesianForPoint:newLeft height:height];
    newRight = [self cartesianForPoint:newRight height:height ];
    newBottomLeft = [self cartesianForPoint:newBottomLeft height:height];
    newBottomRight = [self cartesianForPoint:newBottomRight height:height];
    
    NSMutableDictionary *rectangleCoordinates = [[NSMutableDictionary alloc] init];
    
    rectangleCoordinates[@"inputTopLeft"] = [CIVector vectorWithCGPoint:newLeft];
    rectangleCoordinates[@"inputTopRight"] = [CIVector vectorWithCGPoint:newRight];
    rectangleCoordinates[@"inputBottomLeft"] = [CIVector vectorWithCGPoint:newBottomLeft];
    rectangleCoordinates[@"inputBottomRight"] = [CIVector vectorWithCGPoint:newBottomRight];
    
    ciImage = [ciImage imageByApplyingFilter:@"CIPerspectiveCorrection" withInputParameters:rectangleCoordinates];
    
    CIContext *context = [CIContext contextWithOptions:nil];
    CGImageRef cgimage = [context createCGImage:ciImage fromRect:[ciImage extent]];
    UIImage *image = [UIImage imageWithCGImage:cgimage];
    
    NSData *imageToEncode = UIImageJPEGRepresentation(image, 0.8);
    
    dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_BACKGROUND, 0), ^{
        NSArray *paths = NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES);
        NSString *documentsDirectory = [paths objectAtIndex:0];
        NSString *uuid = [[NSUUID new] UUIDString];
        NSString *dataPath = [documentsDirectory stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.jpg", uuid]];
        [imageToEncode writeToFile:dataPath atomically:YES];
        callback(@[[NSNull null], @{@"image": dataPath}]);
    });

    CGImageRelease(cgimage);
}

- (CGPoint)cartesianForPoint:(CGPoint)point height:(float)height {
    return CGPointMake(point.x, height - point.y);
}


- (UIImage *)fixOrientation:(UIImage *)image
{
     // No-op if the orientation is already correct.
     if (image.imageOrientation == UIImageOrientationUp) {
         return image;
     }
     
     // We need to calculate the proper transformation to make the image upright.
     // We do it in 2 steps: Rotate if Left/Right/Down, and then flip if Mirrored.
     CGAffineTransform transform = CGAffineTransformIdentity;
     
     switch (image.imageOrientation) {
         case UIImageOrientationDown:
         case UIImageOrientationDownMirrored:
             transform = CGAffineTransformTranslate(transform, image.size.width, image.size.height);
             transform = CGAffineTransformRotate(transform, M_PI);
             break;
             
         case UIImageOrientationLeft:
         case UIImageOrientationLeftMirrored:
             transform = CGAffineTransformTranslate(transform, image.size.width, 0);
             transform = CGAffineTransformRotate(transform, M_PI_2);
             break;
             
         case UIImageOrientationRight:
         case UIImageOrientationRightMirrored:
             transform = CGAffineTransformTranslate(transform, 0, image.size.height);
             transform = CGAffineTransformRotate(transform, -M_PI_2);
             break;
         case UIImageOrientationUp:
         case UIImageOrientationUpMirrored:
             break;
     }
     
     switch (image.imageOrientation) {
         case UIImageOrientationUpMirrored:
         case UIImageOrientationDownMirrored:
             transform = CGAffineTransformTranslate(transform, image.size.width, 0);
             transform = CGAffineTransformScale(transform, -1, 1);
             break;
             
         case UIImageOrientationLeftMirrored:
         case UIImageOrientationRightMirrored:
             transform = CGAffineTransformTranslate(transform, image.size.height, 0);
             transform = CGAffineTransformScale(transform, -1, 1);
             break;
         case UIImageOrientationUp:
         case UIImageOrientationDown:
         case UIImageOrientationLeft:
         case UIImageOrientationRight:
             break;
     }
     
     // Now we draw the underlying CGImage into a new context, applying the transform
     // calculated above.
     CGContextRef ctx = CGBitmapContextCreate(NULL, image.size.width, image.size.height,
                                              CGImageGetBitsPerComponent(image.CGImage), 0,
                                              CGImageGetColorSpace(image.CGImage),
                                              CGImageGetBitmapInfo(image.CGImage));
     CGContextConcatCTM(ctx, transform);
     switch (image.imageOrientation) {
         case UIImageOrientationLeft:
         case UIImageOrientationLeftMirrored:
         case UIImageOrientationRight:
         case UIImageOrientationRightMirrored:
             CGContextDrawImage(ctx, CGRectMake(0, 0, image.size.height, image.size.width), image.CGImage);
             break;
             
         default:
             CGContextDrawImage(ctx, CGRectMake(0, 0, image.size.width, image.size.height), image.CGImage);
             break;
     }
     
     // And now we just create a new UIImage from the drawing context.
     CGImageRef cgimg = CGBitmapContextCreateImage(ctx);
     UIImage *img = [UIImage imageWithCGImage:cgimg];
     CGContextRelease(ctx);
     CGImageRelease(cgimg);
     
     return img;
}

// MARK: Rectangle Detection

- (void)detectRectangleFromImage:(CIImage *)image completion:(void (^)(NSDictionary* coordinates))completion
{
   dispatch_async(_rectangleDetectionQueue, ^{

     @autoreleasepool {
       @try {
         // need to convert the CI image to a CG image before use, otherwise there can be some unexpected behaviour on some devices
         CIContext *context = [CIContext contextWithOptions:nil];
         CGImageRef cgDetectionImage = [context createCGImage:image fromRect:image.extent];
         CIImage *detectionImage = [CIImage imageWithCGImage:cgDetectionImage];
         detectionImage = [detectionImage imageByApplyingOrientation:kCGImagePropertyOrientationLeft];

         CIRectangleFeature* rectangleFeature = [self biggestRectangleInRectangles:[[self highAccuracyRectangleDetector] featuresInImage:detectionImage] image:detectionImage];
         CGRect rectangleBounds = detectionImage.extent;
         
         CGImageRelease(cgDetectionImage);
         
         if (rectangleFeature) {
           NSDictionary *rectangleCoordinates = [self computeRectangle:rectangleFeature forImage: detectionImage];
           completion(rectangleCoordinates);
         } else {
           completion(nil);
         }
       }
       @catch (NSException * e) {
         NSLog(@"Failed to parse image: %@", e);
         completion(nil);
       }
     }
   });
}

/*!
  Gets a rectangle detector that can be used to plug an image into and find the rectangles from
  */
- (CIDetector *)highAccuracyRectangleDetector
{
     static CIDetector *detector = nil;
     static dispatch_once_t onceToken;
     dispatch_once(&onceToken, ^
     {
         detector = [CIDetector detectorOfType:CIDetectorTypeRectangle context:nil options:@{CIDetectorAccuracy : CIDetectorAccuracyHigh, CIDetectorReturnSubFeatures: @(YES) }];
     });
     return detector;
}

/*!
  Finds the best fitting rectangle from the list of rectangles found in the image
  */
- (CIRectangleFeature *)biggestRectangleInRectangles:(NSArray *)rectangles image:(CIImage *)image
{
   if (![rectangles count]) return nil;

   float halfPerimiterValue = 0;

   CIRectangleFeature *biggestRectangle = [rectangles firstObject];

   for (CIRectangleFeature *rect in rectangles) {
     CGPoint p1 = rect.topLeft;
     CGPoint p2 = rect.topRight;
     CGFloat width = hypotf(p1.x - p2.x, p1.y - p2.y);

     CGPoint p3 = rect.topLeft;
     CGPoint p4 = rect.bottomLeft;
     CGFloat height = hypotf(p3.x - p4.x, p3.y - p4.y);

     CGFloat currentHalfPerimiterValue = height + width;

     if (halfPerimiterValue < currentHalfPerimiterValue) {
       halfPerimiterValue = currentHalfPerimiterValue;
       biggestRectangle = rect;
     }
   }

   return biggestRectangle;
}

/*!
  Maps the coordinates to the correct orientation.  This maybe can be cleaned up and removed if the orientation is set on the input image.
  */
- (NSDictionary *) computeRectangle: (CIRectangleFeature *) rectangle forImage: (CIImage *) image {
   CGRect imageBounds = image.extent;
   if (!rectangle) return nil;
   return @{
     @"topRight": @{
         @"y": @(rectangle.topLeft.x),
         @"x": @(rectangle.topLeft.y)
     },
     @"bottomRight": @{
         @"y": @(rectangle.topRight.x),
         @"x": @(rectangle.topRight.y)
     },
     @"topLeft": @{
         @"y": @(rectangle.bottomLeft.x),
         @"x": @(rectangle.bottomLeft.y)
     },
     @"bottomLeft": @{
         @"y": @(rectangle.bottomRight.x),
         @"x": @(rectangle.bottomRight.y)
     },
     @"dimensions": @{@"height": @(imageBounds.size.width), @"width": @(imageBounds.size.height)}
   };
}

/*!
  Checks if the confidence of the current rectangle is above a threshold. The higher, the more likely the rectangle is the desired object to be scanned.
  */
BOOL isRectangleDetectionConfidenceHighEnough(float confidence)
{
     return (confidence > 1.0);
}


@end
