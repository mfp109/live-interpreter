#import <AppKit/AppKit.h>
#import <CoreAudio/AudioHardware.h>
#import <CoreAudio/AudioHardwareTapping.h>
#import <CoreAudio/CATapDescription.h>
#import <Foundation/Foundation.h>
#import <libproc.h>
#import <signal.h>

static AudioObjectID activeTap = kAudioObjectUnknown;
static AudioObjectID activeAggregate = kAudioObjectUnknown;

static AudioObjectPropertyAddress addressFor(AudioObjectPropertySelector selector) {
    return (AudioObjectPropertyAddress){ selector, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain };
}

static BOOL getUInt32(AudioObjectID objectID, AudioObjectPropertySelector selector, UInt32 *value) {
    AudioObjectPropertyAddress address = addressFor(selector);
    UInt32 size = sizeof(UInt32);
    return AudioObjectGetPropertyData(objectID, &address, 0, NULL, &size, value) == noErr;
}

static NSString *getString(AudioObjectID objectID, AudioObjectPropertySelector selector) {
    AudioObjectPropertyAddress address = addressFor(selector);
    CFStringRef value = NULL;
    UInt32 size = sizeof(value);
    if (AudioObjectGetPropertyData(objectID, &address, 0, NULL, &size, &value) != noErr || !value) return @"";
    return CFBridgingRelease(value);
}

static NSArray<NSNumber *> *audioProcessObjectIDs(void) {
    AudioObjectPropertyAddress address = addressFor(kAudioHardwarePropertyProcessObjectList);
    UInt32 size = 0;
    if (AudioObjectGetPropertyDataSize(kAudioObjectSystemObject, &address, 0, NULL, &size) != noErr || size == 0) return @[];
    NSUInteger count = size / sizeof(AudioObjectID);
    AudioObjectID *ids = calloc(count, sizeof(AudioObjectID));
    if (!ids) return @[];
    if (AudioObjectGetPropertyData(kAudioObjectSystemObject, &address, 0, NULL, &size, ids) != noErr) {
        free(ids);
        return @[];
    }
    NSMutableArray<NSNumber *> *result = [NSMutableArray arrayWithCapacity:count];
    for (NSUInteger index = 0; index < count; index++) [result addObject:@(ids[index])];
    free(ids);
    return result;
}

static NSDictionary *processInfo(NSNumber *processNumber) {
    AudioObjectID processID = processNumber.unsignedIntValue;
    UInt32 pidValue = 0;
    UInt32 runningOutput = 0;
    if (!getUInt32(processID, kAudioProcessPropertyPID, &pidValue) || pidValue == getpid()) return nil;
    getUInt32(processID, kAudioProcessPropertyIsRunningOutput, &runningOutput);
    NSString *bundleID = getString(processID, kAudioProcessPropertyBundleID);
    NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:(pid_t)pidValue];
    NSString *name = application.localizedName ?: bundleID.lastPathComponent;
    if (name.length == 0 || bundleID.length == 0) return nil;
    return @{
        @"processObjectID": @(processID),
        @"pid": @(pidValue),
        @"bundleID": bundleID,
        @"name": name,
        @"runningOutput": @(runningOutput != 0),
    };
}

static void printJSON(id object) {
    NSData *data = [NSJSONSerialization dataWithJSONObject:object options:0 error:nil];
    fwrite(data.bytes, 1, data.length, stdout);
    fwrite("\n", 1, 1, stdout);
    fflush(stdout);
}

static void cleanup(void) {
    if (activeAggregate != kAudioObjectUnknown) {
        AudioHardwareDestroyAggregateDevice(activeAggregate);
        activeAggregate = kAudioObjectUnknown;
    }
    if (activeTap != kAudioObjectUnknown) {
        AudioHardwareDestroyProcessTap(activeTap);
        activeTap = kAudioObjectUnknown;
    }
}

static void handleSignal(int signalNumber) {
    (void)signalNumber;
    exit(0);
}

static int listProcesses(void) {
    NSMutableArray<NSDictionary *> *items = [NSMutableArray array];
    for (NSRunningApplication *application in NSWorkspace.sharedWorkspace.runningApplications) {
        NSString *bundleID = application.bundleIdentifier ?: @"";
        NSString *name = application.localizedName ?: @"";
        if (application.processIdentifier == getpid() || bundleID.length == 0 || name.length == 0) continue;
        if (application.activationPolicy != NSApplicationActivationPolicyRegular) continue;
        if ([bundleID hasPrefix:@"tech.shalomworks.live-interpreter"]) continue;
        [items addObject:@{
            @"pid": @(application.processIdentifier),
            @"bundleID": bundleID,
            @"name": name,
        }];
    }
    [items sortUsingComparator:^NSComparisonResult(NSDictionary *left, NSDictionary *right) {
        return [left[@"name"] localizedCaseInsensitiveCompare:right[@"name"]];
    }];
    printJSON(items);
    return 0;
}

static AudioObjectID processObjectForPID(pid_t pid) {
    AudioObjectPropertyAddress address = addressFor(kAudioHardwarePropertyTranslatePIDToProcessObject);
    AudioObjectID processID = kAudioObjectUnknown;
    UInt32 size = sizeof(processID);
    if (AudioObjectGetPropertyData(kAudioObjectSystemObject, &address, sizeof(pid), &pid, &size, &processID) != noErr) return kAudioObjectUnknown;
    return processID;
}

static BOOL processIsDescendantOf(pid_t childPID, pid_t ancestorPID) {
    pid_t currentPID = childPID;
    for (NSUInteger depth = 0; depth < 16 && currentPID > 1; depth++) {
        struct proc_bsdinfo info = {0};
        int size = proc_pidinfo(currentPID, PROC_PIDTBSDINFO, 0, &info, sizeof(info));
        if (size != sizeof(info) || info.pbi_ppid <= 1) return NO;
        currentPID = (pid_t)info.pbi_ppid;
        if (currentPID == ancestorPID) return YES;
    }
    return NO;
}

static NSArray<NSNumber *> *audioProcessObjectsForApplicationPID(pid_t applicationPID) {
    NSMutableArray<NSNumber *> *applicationMatches = [NSMutableArray array];
    AudioObjectID directID = processObjectForPID(applicationPID);
    for (NSNumber *processNumber in audioProcessObjectIDs()) {
        NSDictionary *info = processInfo(processNumber);
        if (!info) continue;
        pid_t candidatePID = (pid_t)[info[@"pid"] intValue];
        if (candidatePID == applicationPID || processIsDescendantOf(candidatePID, applicationPID)) {
            [applicationMatches addObject:processNumber];
        }
    }
    // Include idle audio helpers too. Zoom (caphost), Safari and Chromium apps
    // can begin output through an existing helper only after the tap is made.
    if (applicationMatches.count > 0) return applicationMatches;
    return directID == kAudioObjectUnknown ? @[] : @[@(directID)];
}

static NSDictionary *applicationInfoForPID(pid_t pid, NSArray<NSNumber *> *processIDs) {
    NSRunningApplication *application = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
    NSString *name = application.localizedName ?: @"";
    NSString *bundleID = application.bundleIdentifier ?: @"";
    if (name.length > 0) return @{ @"name": name, @"bundleID": bundleID };
    NSDictionary *fallback = processIDs.count > 0 ? processInfo(processIDs.firstObject) : nil;
    return fallback ?: @{};
}

static int startTap(pid_t pid) {
    NSArray<NSNumber *> *processIDs = audioProcessObjectsForApplicationPID(pid);
    if (processIDs.count == 0) {
        printJSON(@{ @"error": @"このアプリの音声プロセスを確認できません。アプリで音声を再生してから、もう一度選んでください。" });
        return 2;
    }
    NSDictionary *info = applicationInfoForPID(pid, processIDs);
    if ([info[@"name"] length] == 0) {
        printJSON(@{ @"error": @"選択したアプリの情報を取得できません。" });
        return 2;
    }

    CATapDescription *description = [[CATapDescription alloc] initStereoMixdownOfProcesses:processIDs];
    description.name = [NSString stringWithFormat:@"Live Interpreter - %@", info[@"name"]];
    description.UUID = [NSUUID UUID];
    description.privateTap = NO;
    description.muteBehavior = CATapMuted;

    OSStatus status = AudioHardwareCreateProcessTap(description, &activeTap);
    if (status != noErr) {
        printJSON(@{ @"error": [NSString stringWithFormat:@"アプリ音声の取得を開始できませんでした（%d）。", status] });
        return 3;
    }

    NSString *aggregateUID = [NSString stringWithFormat:@"tech.shalomworks.live-interpreter.%@", [NSUUID UUID].UUIDString];
    NSDictionary *tapEntry = @{
        [NSString stringWithUTF8String:kAudioSubTapUIDKey]: description.UUID.UUIDString,
        [NSString stringWithUTF8String:kAudioSubTapDriftCompensationKey]: @YES,
    };
    NSDictionary *composition = @{
        [NSString stringWithUTF8String:kAudioAggregateDeviceNameKey]: description.name,
        [NSString stringWithUTF8String:kAudioAggregateDeviceUIDKey]: aggregateUID,
        [NSString stringWithUTF8String:kAudioAggregateDeviceIsPrivateKey]: @NO,
        [NSString stringWithUTF8String:kAudioAggregateDeviceIsStackedKey]: @NO,
        [NSString stringWithUTF8String:kAudioAggregateDeviceTapListKey]: @[tapEntry],
        [NSString stringWithUTF8String:kAudioAggregateDeviceTapAutoStartKey]: @YES,
    };
    status = AudioHardwareCreateAggregateDevice((__bridge CFDictionaryRef)composition, &activeAggregate);
    if (status != noErr) {
        cleanup();
        printJSON(@{ @"error": [NSString stringWithFormat:@"アプリ音声デバイスを作成できませんでした（%d）。", status] });
        return 4;
    }

    atexit(cleanup);
    signal(SIGINT, handleSignal);
    signal(SIGTERM, handleSignal);
    printJSON(@{
        @"deviceUID": aggregateUID,
        @"deviceName": description.name,
        @"name": info[@"name"],
        @"bundleID": info[@"bundleID"],
    });
    [[NSRunLoop currentRunLoop] run];
    return 0;
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc < 2) {
            printJSON(@{ @"error": @"操作が指定されていません。" });
            return 1;
        }
        NSString *command = [NSString stringWithUTF8String:argv[1]];
        if ([command isEqualToString:@"list"]) return listProcesses();
        if ([command isEqualToString:@"tap"] && argc >= 3) return startTap((pid_t)strtol(argv[2], NULL, 10));
        printJSON(@{ @"error": @"未対応の操作です。" });
        return 1;
    }
}
