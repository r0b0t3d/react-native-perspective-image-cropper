
package fr.michaelvilleneuve.customcrop;

import android.graphics.Bitmap;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import org.opencv.android.OpenCVLoader;
import org.opencv.android.Utils;
import org.opencv.core.CvType;
import org.opencv.core.Mat;
import org.opencv.core.Point;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class RNCustomCropModule extends ReactContextBaseJavaModule {

  static {
    if (!OpenCVLoader.initDebug()) {
      Log.e("RNCustomCropModule", "Could not init OpenCV");
    } else {
      Log.d("RNCustomCropModule", "OpenCV initialized!!!");
    }
  }

  private final ReactApplicationContext reactContext;

  public RNCustomCropModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "CustomCropManager";
  }

  @ReactMethod
  public void detectRectangleForImage(String image, Promise promise) {
    RectangleDetector detector = new RectangleDetector(this.getReactApplicationContext(), promise);
    detector.execute(image.replace("file://", ""));
  }

  @ReactMethod
  public void crop(ReadableMap points, String imageUri, Callback callback) {

    Point tl = new Point(points.getMap("topLeft").getDouble("x"), points.getMap("topLeft").getDouble("y"));
    Point tr = new Point(points.getMap("topRight").getDouble("x"), points.getMap("topRight").getDouble("y"));
    Point bl = new Point(points.getMap("bottomLeft").getDouble("x"), points.getMap("bottomLeft").getDouble("y"));
    Point br = new Point(points.getMap("bottomRight").getDouble("x"), points.getMap("bottomRight").getDouble("y"));

    String imageFile = imageUri.replace("file://", "");
    Mat src = Imgcodecs.imread(imageFile, Imgproc.COLOR_BGR2RGB);
    Imgproc.cvtColor(src, src, Imgproc.COLOR_BGR2RGB);

    // FIXME: This ratio introduce bug on my end
    // When the crop rectangle is small,
    // ratioAlreadyApplied will be true and ratio is smaller than 1. So the crop area is not correct
    /* boolean ratioAlreadyApplied = tr.x * (src.size().width / 500) < src.size().width;
    double ratio = ratioAlreadyApplied ? src.size().width / 500 : 1; */
    double ratio = 1;

    double widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
    double widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));

    double dw = Math.max(widthA, widthB) * ratio;
    int maxWidth = Double.valueOf(dw).intValue();

    double heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
    double heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));

    double dh = Math.max(heightA, heightB) * ratio;
    int maxHeight = Double.valueOf(dh).intValue();

    Mat doc = new Mat(maxHeight, maxWidth, CvType.CV_8UC4);

    Mat src_mat = new Mat(4, 1, CvType.CV_32FC2);
    Mat dst_mat = new Mat(4, 1, CvType.CV_32FC2);

    src_mat.put(0, 0, tl.x * ratio, tl.y * ratio, tr.x * ratio, tr.y * ratio, br.x * ratio, br.y * ratio, bl.x * ratio,
        bl.y * ratio);
    dst_mat.put(0, 0, 0.0, 0.0, dw, 0.0, dw, dh, 0.0, dh);

    Mat m = Imgproc.getPerspectiveTransform(src_mat, dst_mat);

    Imgproc.warpPerspective(src, doc, m, doc.size());

    int orientation = getImageOrientation(imageFile);
//
//    Bitmap bitmap = Bitmap.createBitmap(doc.cols(), doc.rows(), Bitmap.Config.ARGB_8888);
//    Utils.matToBitmap(doc, bitmap);
//
//    Matrix matrix = new Matrix();
//    matrix.postRotate(90);
//    Bitmap rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.getWidth(), bitmap.getHeight(), matrix, false);
//
//    ByteArrayOutputStream byteArrayOutputStream = new ByteArrayOutputStream();
//    rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 70, byteArrayOutputStream);
    File file = new File(reactContext.getCacheDir(), System.currentTimeMillis() + ".jpg");
    Imgproc.cvtColor(doc, doc, Imgproc.COLOR_RGB2BGR);
    Imgcodecs.imwrite(file.getPath(), doc);
//    saveToFile(file, byteArrayOutputStream);
    WritableMap map = Arguments.createMap();
    map.putString("image", file.getAbsolutePath());
    callback.invoke(null, map);

    src.release();
    m.release();
  }

  private void saveToFile(File file, ByteArrayOutputStream baos) {
    FileOutputStream fos = null;
    try {
      fos = new FileOutputStream(file);
      baos.writeTo(fos);
    } catch(IOException ioe) {
      // Handle exception here
      ioe.printStackTrace();
    } finally {
      try {
        fos.close();
        baos.close();
      } catch (IOException e) {
        e.printStackTrace();
      }
    }
  }

  private int getImageOrientation(String imgPath) {
    int rotate = 0;
    try {
      ExifInterface exif = new ExifInterface(new File(imgPath).getAbsolutePath());
      int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
      switch (orientation) {
        case ExifInterface.ORIENTATION_ROTATE_270:
          rotate = 270;
          break;
        case ExifInterface.ORIENTATION_ROTATE_180:
          rotate = 180;
          break;
        case ExifInterface.ORIENTATION_ROTATE_90:
          rotate = 90;
          break;
      }
      Log.i("RotateImage", "Exif orientation: " + orientation);
      Log.i("RotateImage", "Rotate value: " + rotate);
    } catch (IOException e) {
      e.printStackTrace();
    }
    return rotate;
  }
}
