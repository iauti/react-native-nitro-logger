#include <jni.h>
#include <fbjni/fbjni.h>
#include "NitroLoggerOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return facebook::jni::initialize(vm, []() {
    margelo::nitro::nitrologger::registerAllNatives();
  });
}
