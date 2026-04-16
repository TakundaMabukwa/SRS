MettaX DashCam Protocol
This document and its contents are proprietary information and trade secrets of MettaX Corporation and are intended solely for use by
authorized internal personnel or formal partners. Without the written permission of MettaX Corporation, no individual or organization
may reproduce, distribute, quote, reprint, or use this document for any commercial purpose in any form. For any requests, please
contact MettaX Technical Support for formal authorization.
For more information, please visit the official MettaX website: www.imettax.com
No.1101, Building A, Block 7, Phase 3, International Innovation Valley, Xili Subdistrict, Nanshan District, Shenzhen, Guangdong, China
Phone: +86 (755)-26419285 | E-mail: info@imettax.com
MettaX Digital (Shenzhen) Co., Ltd.
Version 1.9.0.1
1. ReadMe
The MettaX DashCam is an intelligent driving recorder that integrates high-definition video recording, vehicle-mounted positioning,
intelligent driving assistance, and remote monitoring. To achieve efficient, stable, and secure data interaction between the device and
clients (such as mobile apps and cloud servers), MettaX has designed and implemented a dedicated communication protocol that
covers functions such as device discovery, video streaming, file download, parameter configuration, and alert reporting.
2. Base
The communication protocol employs TCP or UDP. The platform functions as the server-side, while the terminal acts as the client-side.
In the event of data communication link failures, terminals may utilize SMS messaging for communication.
2.1 Data type
Data Type
BYTE
WORD
DWORD
BYTE[n]
BCD[n]
STRING
Description and Requirements
Unsigned single-byte integer (byte, 8 bits)
Unsigned double-byte integer (word, 16 bits)
Unsigned quad-byte integer (double-word, 32 bits)
n bytes
8421 code, n bytes
GBK encoding; if no data, set to empty
2.2 Transmission Rules
The protocol uses big-endian network byte order to transmit words and double-words.
Conventions are as follows:
Byte (BYTE) Transmission Convention: Transmitted as a byte stream.
Word (WORD) Transmission Convention: First transmit the high eight bits, then the low eight bits.
Double-Word (DWORD) Transmission Convention: First transmit the high 24 bits, then the high 16 bits, followed by the high
eight bits, and finally the low eight bits.
2.3 Composition of Messages
Each message consists of an identifier, header, body, and checksum, as illustrated in the message structure diagram:
Identifier
Header
Body
CheckSum
2.3.1 Identifier
The character 
0x7e  is used as a delimiter. If 
Identifier
0x7e  appears in the checksum, header, or body of the message, it must be escaped.
The escape rules are defined as follows:
0x7e  ↔ 
0x7d  followed by 
0x7d  ↔ 
0x02 
0x7d  followed by 
0x01 
The escape processing steps during message transmission and reception are as follows:
Sending a Message
1. Message Encapsulation
2. Calculate and Fill Checksum
3. Escape Processing
Receiving a Message
1. Escape Restoration
2. Verify Checksum
3. Parse Message
Example
When sending a data packet with the content 
2.3.2 Message Header
Starting
Offset
0
2
4
10
12
Field
Message ID
Message Body Attribute
Device Number
Message Sequence
Number
0x30 0x7e 0x08 0x7d 0x55 , the encapsulation process results in:
Data
Type
WORD
WORD
BCD[6]
Description and Requirements--
If less than 12 digits, pad with leading zeros
WORD
Message Packet
Encapsulation Item
2.3.3 Message Body
15
14
Reserved
13
Subpackage
12
11
Cyclically increment from 0 based on send order
If the message body attribute indicates packet processing via relevant
identifier, this field contains content; otherwise, it is absent
10
9
8
7
6
5
Data Encryption Method
Data Encryption Method Details
Bit 10–12: Data Encryption Identifier Bits
000: Indicates that the message body is not encrypted.
Message Body Length
100: Indicates that the message body is encrypted using the RSA algorithm.
Other combinations: Reserved for future use.
4
3
2
1
0
Packeting
When the 13th bit in the message body attribute is 
1 , it indicates that the message body is a long message, and packet sending
processing will be carried out. The specific packet information is determined by the message packet encapsulation items. If the 13th
bit is 
0 , there is no message packet encapsulation item field in the message header.
Starting Byte
0
2
Field
Total Packets
Data Type
WORD
Description and Requirements
The total number of packets after the message is divided.
Packet Sequence
2.3.4 Checksum
WORD
Starts from 1.
The checksum refers to the process starting from the message header, performing an XOR operation with the subsequent byte,
continuing until the byte before the checksum. It occupies one byte.
2.2 General
2.1 Terminal General Response 
0x0001 
Starting
Byte
0
2
4
Field
Response Serial
Number
Response ID
Data
Type
WORD
Description and Requirements
The serial number of the corresponding platform message.
WORD
Result
7e000100051050451339131db5005c920800567e 
BYTE
The ID of the corresponding platform message.
0: Success/Confirmation; 1: Failure; 2: Message Error; 3: Not
Supported
2.2 Platform General Response 
0x8001 
Starting
Byte
0
2
4
Field
Response Serial
Number
Response ID
Data
Type
WORD
WORD
Description and Requirements
The serial number of the corresponding terminal message.
The ID of the corresponding terminal message.
Result
BYTE
7e8001000510504513391371c11db5000100a17e 
0: Success/Confirmation; 1: Failure; 2: Message Error; 3: Not Supported; 4:
Alert Processing Confirmation;
3. Base
3.1 Terminal Registration 0x0100 
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Province ID WORD 0000
2 City/County ID WORD 0000
4 Manufacturer
ID BYTE[5] 3636363636
9 Terminal
Model BYTE[20] 3838383838000000000000000000000000000000
29 Terminal ID BYTE[7] 7 bytes, composed of uppercase letters and numbers. This terminal ID is defined by
the manufacturer. If the number of digits is insufficient, pad with "0X00" at the end.
36 License Plate
Color BYTE 1-Blue,2-Yellow,3-Black,4-White,9-Other,0-No License
37 Vehicle
Identification STRING
When the license plate color is 0, it represents the vehicle VIN; otherwise, it
represents the motor vehicle license plate issued by the public security traffic
management department.
 7e0100002c1050451339131eed0000000036363636363838383838000000000000000000000000000000353133333931330241423838383800d27e  
Response Message  0x8100 
Starting
Byte Field Data
Type Description and Requirements
0 Response Serial
Number WORD The serial number corresponding to the terminal registration message.
2 Result BYTE
0: Success; 1: The vehicle has been registered; 2: There is no such vehicle in
the database; 3: The terminal has been registered; 4: There is no such terminal
in the database.
3 Authentication
Code STRING
This field is only present when the registration is successful. The verification
code is obtained by first converting the device code to ASCII code and then to
hexadecimal.
 7e8100000f94007786115600010291003934303037373836313135363e7e 
3.2 Terminal Authentication 0x0102 
Process Description
Registration must be completed first, and the authentication code is obtained from the registration response packet.
Message Body
Starting Byte Field Data Type Description and Requirements
0 Authentication Code STRING The terminal reports the authentication code after reconnection.
7e0102000c1050451339130004313035303435313333393133387e 
Response Message 
0x8001 -->2.2 Platform General Response
3.3 Terminal Heartbeat 
0x0002 
Message Body
The message body for terminal heartbeat data is empty.
7e00020000478070000205041ea87e 
Response Message 
0x8001 -->2.2 Platform General Response
4. Location
4.1 Location Information Reporting
Message Body
Location Basic Information
0x0200 
Location Additional Information
Location Basic Information
Starting
Byte
0
4
8
12
16
18
20
21
Field
Alert Flag
Status
Latitude
Longitude
Elevation
Speed
Data
Type
DWORD
DWORD
DWORD
DWORD
WORD
Description and Requirements
7. Alert Flag Bit Definitions
8. Status Bit Definitions
The latitude value in degrees multiplied by 106, accurate to one millionth of a
degree.
The longitude value in degrees multiplied by 106, accurate to one millionth of a
degree.
Elevation above sea level, in meters (m).
WORD
Direction
Time
WORD
BCD[6]
Location Additional Information
Field
Additional Information ID
Additional Information Length
Additional Information
Speed in 1/10 km/h.
0 - 359, with 0 representing true north and increasing clockwise.
YY-MM-DD-hh-mm-ss (same as the device's timezone).
Data Type
BYTE
Description and Requirements
1 - 255
BYTE--
9. Additional Information Definitions
7E02000060353076329902AA1F00000000000C00030158828C06CA8F590054000001442502260616160104000006E70302000014040000000415040000000016
Response Message  0x8001 -->2.2 Platform General Response
4.2 Batch Upload of Positioning Data 0x0704 
Message Body
Starting
Byte Field Data Type Description and Requirements
0 Number of Data
Items WORD The total number of position report data items included in the message. Must
be greater than 0.
1 Position Data
Type BYTE
0: Normal Batch Position Report
1: Blind Spot Supplement Report
2 Position Report
Data Items VARIABLE Follows the Position Report Data Item Data Format. The number of data items
corresponds to the value specified in the "Number of Data Items" field.
Position Report Data Item Data Format
Starting
Byte Field Data
Type Description and Requirements
0 Length of Position Report
Body WORD The length of the position report body in bytes, denoted as n.
2 Position Report Body BYTE[n] Follows the Position Information Report format as described in
section 2.14.
 7e07040065105045133913000b000101006000000000000c000f0167d94c02c7f2d100d000000000250217161345010400000472030200001404000000011504
Response Message  0x8001 -->2.2 Platform General Response
5. Alert
5.1 Alert Types
Alert Type Alert Code Alert Name (EN) AI Alert
File Define Rules
Device unplanned Unplanned Alert--
Device gpsBlindZone GPS Blind Zone--
Device passengerOverload Passenger Overload--
Device idleSpeed Idle Alert--
Device drStorageFault Disaster Recovery
Storage Failure N 9. Additional Information Definitions 0x17
Device mainMemoryFault Main Memory Fault N 9. Additional Information Definitions 0x17
Device videoSignalLost Video Signal Lost N 9. Additional Information Definitions 0x15
Device drift Device Drift N 7. Alert Flag Bit Definitions 28
Alert Type
Device
Device
Device
Device
Device
Device
Device
Device
Device
Device
Device
Device
ADAS
ADAS
ADAS
ADAS
ADAS
BSD
BSD
BSD
BSD
DMS
DMS
DMS
DMS
Alert Code
tamper
shake
outage
external
externalProtection
internal
outFence
inFence
accOn
accOff
ioOn
ioOff
laneShift
forwardCollisionWarning
closeProximity
pedestrianBang
driverChange
bsdBack
bsdLeft
bsdRight
bsdFront
Alert Name (EN)
Device Tamper
Device Vibration
Device Power
Outage
Low External Power
Low Power
Protection
Low Internal Power
Exit Geo-Fence
Enter Geo-Fence
ACC On
ACC Off
IO On
IO Off
Lane Shift
Forward Collision
Too Close
AI Alert
File
N
N
N
N----
N
N
N
N
Define Rules
7. Alert Flag Bit Definitions 16
7. Alert Flag Bit Definitions 15
7. Alert Flag Bit Definitions 8
7. Alert Flag Bit Definitions 7----
8. Status Bit Definitions 0
8. Status Bit Definitions 0
13. Extended Vehicle Signal Status Bits 1
13. Extended Vehicle Signal Status Bits 1
Y
Y
Y
Pedestrian Collision
Driver Change
Back BSD
Left BSD
Right BSD
Front BSD
handheldPhoneCall
smoking
longTimeWithoutLookingAhead
driverNotDetected
DMS
bothHandsOffSteeringWheel
Phone Calling
Smoking
Distracted Driving
No Driver Detected
Hand Off Detection
(HOD)
Y
Y
Y
Y
Y
Y
Y
Y
Y
Y
Y
37. Advanced Driver Assistance System
(ADAS) Alert Information Data Format
0x02
37. Advanced Driver Assistance System
(ADAS) Alert Information Data Format
0x01
37. Advanced Driver Assistance System
(ADAS) Alert Information Data Format
0x03
37. Advanced Driver Assistance System
(ADAS) Alert Information Data Format
0x04
39. Alert Identifier Format 0x11
42. Blind Spot Monitoring System (BSM)
Alert 0x01
42. Blind Spot Monitoring System (BSM)
Alert 0x02
42. Blind Spot Monitoring System (BSM)
Alert 0x03
42. Blind Spot Monitoring System (BSM)
Alert 0xE0
39. Alert Identifier Format 0x02
39. Alert Identifier Format 0x03
39. Alert Identifier Format 0x04
39. Alert Identifier Format 0x05
39. Alert Identifier Format 0x06
Alert Type
DMS
DMS
DMS
DMS
DMS
GSENSOR rapid
GSENSOR slow
GSENSOR wheel
GSENSOR bang
Alert Code
driverBehaviorMonitoringFailure
playPhone
seatBelt
occlusion
identification
GSENSOR hardBraking
IO
IO
POSITION
POSITION
POSITION
POSITION
SPEED
SPEED
sos
powerCut
fatigueAlert
inGpsBlindSpots
Alert Name (EN)
Infrared Blocking
Play Phone
Seat-Belt Detection
Camera Blocked
Driver ID Detection
Rapid Acceleration
Rapid Deceleration
Sharp Turn
Crash
Rollover
AI Alert
File
Y
N
Y
Y
Y
Y
Y
Define Rules
39. Alert Identifier Format 0x07
39. Alert Identifier Format 0x0d
39. Alert Identifier Format 0x08
TODO
39. Alert Identifier Format 0x0a
Y
N
Y
SOS Alert
Power Loss Alert
Fatigue Alert
outGpsBlindSpots
overtime
overspeedWarning
speed
SPEED
parking
Enter GPS Blind
Zone
Exit GPS Blind Zone
Driving Overtime
High Speed Warning
Overspeed Alert
Overtime Parking
N
Y--
N
N
N
N
52. Aggressive Driving Alert Definition
Data Format 0x01
52. Aggressive Driving Alert Definition
Data Format 0x02
52. Aggressive Driving Alert Definition
Data Format 0x03
7. Alert Flag Bit Definitions 29
7. Alert Flag Bit Definitions 30
7. Alert Flag Bit Definitions 0
39. Alert Identifier Format 0x01 7. Alert
Flag Bit Definitions 2&14--
7. Alert Flag Bit Definitions 18
7. Alert Flag Bit Definitions 13
7. Alert Flag Bit Definitions 1
7. Alert Flag Bit Definitions 19
5.2 Manual Confirmation of Alert Messages
0x8203 
Message Body
Starting
Byte
0
Field
Alert Message Serial
Number
2
Data
Type
WORD
Description
The serial number of the alert message that requires manual confirmation.
A value of 
0  indicates all messages of that alert type.
Manual Confirmation
Alert Type
DWORD Refer to Appendix - 15 for the definition of manual confirmation alert types.
00000001 confirm SoS
7e820300069400778611563040004300000001977e 
Response Message 
0x1001 -->2.1 Terminal General Response
5.3 Alert Attachment Upload Instruction
Process Description
After the platform receives alert/event information with attachments, it sends an attachment upload instruction to the terminal.
Message Body  0x9208 
Starting Byte Field Data Type Description and Requirements
0 Attachment Server IP Address Length BYTE Length k
1 Attachment Server IP Address STRING Server IP address
example:"f" ->ASCII 66(hex)
1 + k Attachment Server Port (TCP) WORD Server port number when using TCP transmission
3 + k Attachment Server Port (UDP) WORD Server port number when using UDP transmission
5 + k Alert Identification Number BYTE[16] 38. Alert Identifier Format
21 + k Alert Number BYTE[32] Unique number assigned to the alert by the platform
53 + k Reserved BYTE[16]
 7e92080052105045133913005c0d3133302e37332e33362e32343365d30000000000000000002502261122340005003137343035343031353631373536353237
Alert Attachment Reporting
Starting
Byte Field Data
Type Description and Requirements
0 Total Number of
Data Blocks DWORD Total number of data blocks in the record file
4 Current Data Block
Number DWORD Serial number of the current data block in the record file
8 Alert Flag DWORD 7. Alert Flag Bit Definitions
12 Vehicle Status DWORD 8. Status Bit Definitions
16 Latitude DWORD Latitude value in degrees multiplied by 10^6, accurate to one millionth of a
degree
20 Longitude DWORD Longitude value in degrees multiplied by 10^6, accurate to one millionth of a
degree
24 Satellite Elevation WORD Satellite altitude, in meters (m)
26 Satellite Speed WORD 1/10 km/h
28 Satellite Direction WORD 0 - 359, with 0 as true north and clockwise direction
30 Time BCD[6] YY-MM-DD-hh-mm-ss (same as device timezone)
36 X-axis Acceleration WORD Acceleration in g multiplied by 10^2, accurate to one hundredth of a g
38 Y-axis Acceleration WORD Acceleration in g multiplied by 10^2, accurate to one hundredth of a g
40 Z-axis Acceleration WORD Acceleration in g multiplied by 10^2, accurate to one hundredth of a g
42 X-axis Angular
Velocity WORD Angular velocity in degrees per second multiplied by 10^2, accurate to one
hundredth of a degree per second
Starting
Byte
44
46
48
50
52
53
54
55
56
58
60
61
63
Field
Y-axis Angular
Velocity
Z-axis Angular
Velocity
Pulse Speed
OBD Speed
Gear Status
Accelerator Pedal
Travel Value
Brake Pedal Travel
Value
Brake Status
Engine Speed
Steering Wheel
Angle
Data
Type
WORD
WORD
WORD
WORD
BYTE
BYTE
BYTE
Description and Requirements
Angular velocity in degrees per second multiplied by 10^2, accurate to one
hundredth of a degree per second
Angular velocity in degrees per second multiplied by 10^2, accurate to one
hundredth of a degree per second
1/10 km/h
1/10 km/h
0 : Neutral
1 - 9 : Gears
10 : Reverse Gear
11 : Park Gear
Range: 1 - 100, unit: %
Range: 1 - 100, unit: %
BYTE 0 : No brake applied
1 : Brake applied
WORD
WORD
Turn Signal Status
Reserved
Checksum
BYTE
BYTE[2]
BYTE
Response Message 
0x1001 -->2.1 Terminal General Response
Unit: RPM
Angle turned by the steering wheel, positive for clockwise, negative for
counterclockwise
0 : No turn signal activated
1 : Left turn signal activated
2 : Right turn signal activated
The sum of all characters from the first character to the character before the
Checksum, and then take the lower 8 bits of the sum as the Checksum value.
5.4 Alert Attachment Information Message
Message Body
Starting
Byte
0
7
23
55
56
Field Name
Terminal ID
Alert Identifier
Alert Number
Information Type
Data
Type
BYTE[7]
BYTE[16]
BYTE[32]
38. Alert Identifier Format
0x1210 
Description and Requirements
7 bytes, composed of uppercase letters and digits. This Terminal ID is defined
by the manufacturer. If the number of digits is insufficient, pad with "0x00".
Unique number assigned by the platform to the alert
BYTE
Attachment Count
BYTE
0x00: Normal Alert File Information
0x01: Resubmitted Alert File Information
Number of attachments associated with the alert
Starting
Byte
57
Field Name
Attachment
Information List
Data
Type
Description and Requirements--
When the attachment server receives the alert attachment information message uploaded by the terminal, it sends a general response
message to the terminal. If the connection between the terminal and the attachment server is abnormally disconnected during the
upload of alert attachments, when the connection is restored, the alert attachment information message needs to be resent. The
attachment files in the message are those that were not uploaded or completed before the disconnection.
Alert Attachment Message Data Format
Starting Byte
0
1
1 + k
Field Name
File Name Length
File Name
Data Length
BYTE
Description and Requirements
Length k
STRING
File Size
File Naming Rules:
DWORD
File name string
Current size of the file
<file type>_<channel number>_<alert type>_<sequence number>_<alert number>.<suffix> 
00_65_650a_00_17411688499780201056613490824476.jpg 00_65_650a_01_17411688499780201056613490824476.jpg 00_65_650a_02_174116884997
Field Definitions:
• File Type:
◦ 00 —— Image
◦ 01 —— Audio
◦ 02 —— Video
◦ 03 —— Text
◦ 04 —— Other
• Channel Number:
◦ 0–37: Video channels.
◦ 64: ADAS module video channel.
◦ 65: DMS module video channel.
◦ If the attachment is independent of the channel, directly fill in 0.
• Alert Type: Encoding composed of the peripheral ID and the corresponding module alert type. For example, forward collision alert is
represented as "6401".
• Sequence Number: Used to distinguish file numbers of the same channel and same type.
• Alert Number: Unique number assigned by the platform to the alert.
• Suffix:
◦ jpg or png for image files
◦ mp4 for video files
◦ bin for text files
The attachment server sends a general response message to the terminal after receiving the alert attachment information instruction
reported by the terminal.
Response Message 
0x8001 -->2.2 Platform General Response
5.4 File Information Upload
0x1211 
Process Description
After the terminal sends an alert attachment information instruction to the attachment server and receives a response, it sends an
attachment file information message to the attachment server.
Message Body 
0x1211 
Starting Byte
0
1
1 + l
2 + l
Field
File Name Length
File Name
File Type
Data Length
BYTE
STRING
Description and Requirements
The length of the file name is 1.
The name of the file.
0x00 : Image
0x01 : Audio
BYTE
File Size
DWORD
0x02 : Video
0x03 : Text
0x04 : Other
The size of the current file being uploaded.
After the attachment server receives the attachment file information instruction reported by the terminal, it sends a general response
message to the terminal.
File Data Upload
After the terminal sends a file information upload instruction to the attachment server and receives a response, it sends the file data to
the attachment server.
Starting
Byte
0
4
54
58
62
Field
Frame Header
Identifier
File Name
Data Offset
Data Length
Data
Length
DWORD
BYTE[50]
DWORD
Description and Requirements
Fixed value: 
0x30 0x31 0x63 0x64 
The name of the file.
The data offset of the current transmitted file.
DWORD
Data Body
BYTE[n]
The length of the payload data.
Default length is 64K. If the file is smaller than 64K, it is the actual
length.
When the attachment server receives the file stream reported by the terminal, no response is required.
Response Message 
0x8001 -->2.2 Platform General Response
5.5 File Upload Completion Message 
Process Description
0x1212 
When the terminal completes sending a file's data to the attachment server, it sends a file upload completion message to the
attachment server.
Message Body
Starting Byte Field Data Length Description and Requirements
0 File Name Length BYTE I  (Indicates the actual length of the file name)
1 File Name STRING The name of the file.
1 + I File Type BYTE
 0x00 : Image
 0x01 : Audio
 0x02 : Video
 0x03 : Text
 0x04 : Other
2 + I File Size DWORD The size of the current uploaded file.
Response Message  0x9212 
When the attachment server receives the file upload completion message reported by the terminal, it sends a response to
acknowledge the file upload completion.
Starting
Byte Field Data
Length Description and Requirements
0 File Name Length BYTE I  (Indicates the actual length of the file name)
1 File Name STRING The name of the file.
1 + I File Type BYTE
 0x00 : Image
 0x01 : Audio
 0x02 : Video
 0x03 : Text
 0x04 : Other
2 + I Upload Result BYTE
 0x00 : Completed
 0x01 : Requires Resubmission
3 + I Number of Packets to
Resubmit BYTE The number of data packets that need to be resubmitted. This value is
 0  if no resubmission is needed.
4 + I List of Packets to
Resubmit VARIABLE Details of the packets that need to be resubmitted.
List of Packets to Resubmit
Starting Byte Field Data Length Description and Requirements
0 Data Offset DWORD The offset of the data that needs to be resubmitted within the file.
4 Data Length DWORD The length of the data that needs to be resubmitted.
Notes:
If there are packets that need to be resubmitted, the terminal should perform the resubmission through file data upload. After
completing the resubmission, it should report the file upload completion message again until all file data has been successfully
sent.
Once all files have been sent, the terminal should proactively disconnect from the attachment server.
6. Device
6.1 Terminal Control
0x8105 
Message Body
Starting Byte
0
Field
Command Word
Data Type
Description and Requirements
BYTE
7e810500012400704172613fdf70137e 
Response Message 
0x1001 -->2.1 Terminal General Response
6.2 Text Message Transmission
Message Body
Starting Byte
0
1
Field
Flag
0x8300 
Data Type
BYTE
Differentiate by mode:
0x70(112) - Off Relay;
0x71(113) - On Relay
Description and Requirements
[16. Text Message Flag Definitions] (#a.16)
Text Information
Response Message 
0x1001 -->2.1 Terminal General Response
STRING
Maximum length of 1024 bytes, encoded in GBK.
6.3 Data Downlink Transparent Transmission
0x8900 
Message Body
Starting Byte
0
Field Name
Pass-through Message Type
1
Data Type
BYTE
Description and Requirements
18 for Pass-through Message Type Definition
Pass-through Message Content
Response Message (0x0900)
Starting Byte
0
1
Field Name
Pass-through Message Type--
Data Type
Description and Requirements
BYTE
Pass-through Message Content
18 for Pass-through Message Type Definition
7. Capture
7.1 Capture Command
7.1 Camera Immediate Capture Command 0x8801 
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Channel ID BYTE
 0x00  -  0x25 : Host uses camera channels for photo capture.
 0x64 : Control ADAS for photo capture.
 0x65 : Control DMS for photo capture.
1 Capture Command WORD
 0 : Stop capturing.
 0xFFFF : Start recording video.
Others: Number of photos to capture.
3 Capture Interval /
Recording Time WORD
Time in seconds.
 0 : Capture photos at the minimum interval or record video
continuously.
5 Save Flag BYTE
 1 : Save the captured media locally.
 0 : Upload the media in real-time.
6 Resolution BYTE
 0x01 : 320×240
 0x02 : 640×480
 0x03 : 800×600
 0x04 : 1024×768
 0x05 : 176×144 [Qcif]
 0x06 : 352×288 [Cif]
 0x07 : 704×288 [HALF D1]
 0x08 : 704×576 [D1]
If the terminal does not support the requested resolution, it captures and
uploads using the closest supported resolution.
7 Image/Video Quality BYTE 1  -  10 , where  1  represents minimal quality loss and  10  represents
maximum compression ratio.
8 Brightness BYTE Range:  0  -  255 .
9 Contrast BYTE Range:  0  -  127 .
10 Saturation BYTE Range:  0  -  127 .
11 Chroma BYTE Range:  0  -  255 .
 7e8801000c105045133913005b020001000000040580404080e07e 
Response Message  0x0805 
Starting
Byte Field Data Type Description and Requirements
0 Response Serial
Number WORD The serial number corresponding to the platform's Camera Immediate
Capture Command.
2 Result BYTE
 0 : Success
 1 : Failure
 2 : Channel not supported.
Fields below are valid only if  Result = 0 .
3 Number of Multimedia
IDs WORD n , the number of successfully captured multimedia items.
4 Multimedia ID List BYTE[4×n] Write the file stream as an image file
 7e080500051050451339131d80005b000000f27e 
8. Real-time Audio and Video
8.1 Real-time Audio and Video Transmission Request 0x9101 
Process Description
The platform initiates a request to the terminal device for real-time audio and video transmission. This includes real-time video
transmission, initiating two-way voice intercom, one-way listening, broadcasting voice to all terminals, and specific passthrough
transmissions. The platform establishes a transmission link using the corresponding server IP address and port number, and then
transmits the relevant audio and video stream data according to the audio and video stream transmission protocol.
Upon receiving a special alert from the video terminal, the platform should proactively issue this command without waiting for manual
confirmation to initiate real-time audio and video transmission.
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Server IP Address Length BYTE Length  n  of the server IP address.
1 Server IP Address STRING Real-time video server IP address.
1+n Server Video Channel Listen Port
(TCP) WORD TCP port number on which the real-time video server is
listening.
3+n Server Video Channel Listen Port
(UDP) WORD UDP port number on which the real-time video server is
listening.
5+n Logical Channel Number BYTE Identifier for the logical channel used for transmission.
6+n Data Type BYTE
 0 : Audio and Video
 1 : Video Only
 2 : Two-way Intercom
 3 : Listening
 4 : Central Broadcast
 5 : Passthrough
Starting
Byte Field Data
Type Description and Requirements
7+n Stream Type BYTE
 0 : Main Stream
 1 : Sub-stream
 7e91010016105045133913afc20e32302e3230352e3137312e323130c78d00000100018c7e 
Response Message  0x1001 -->2.1 Terminal General Response
Real-time Audio and Video and Passthrough Data Transmission
The transmission of real-time audio and video stream data follows the RTP protocol, utilizing either UDP or TCP for transport. The
payload packet format extends the IETF RFC 3550 RTP definition by adding fields such as message sequence number, SIM card
number, audio/video channel number, etc. The bit positions defined in the table are filled in big-endian mode.
Starting
Byte Field Data
Type Description and Requirements
0 Frame Header
Identifier DWORD Fixed value:  0x30 0x31 0x63 0x64 
4 V 2 BITS Fixed value:  2 
P 1 BIT Fixed value:  0 
X 1 BIT Indicates whether the RTP header needs to be extended, fixed at  0 .
CC 4 BITS Fixed value:  1 
5 M 1 BIT Flag bit to determine if it is the boundary of a complete data frame.
PT 7 BITS 6-G711A;7-G711U; 19-AAC
6 Packet Sequence
Number WORD Initially  0 , increments by  1  for each RTP packet sent.
8 SIM Card Number BCD[6] Terminal device SIM card number.
14 Logical Channel
Number BYTE Identifier for the logical channel.
15 Data Type (4 BITS) BYTE
 0000 : Video I-frame
 0001 : Video P-frame
 0010 : Video B-frame
 0011 : Audio Frame
 0100 : Passthrough Data
Packet Handling Flag
(4 BITS) BYTE
 0000 : Atomic packet, cannot be split
 0001 : First packet in packetized processing
 0010 : Last packet in packetized processing
 0011 : Intermediate packet in packetized processing
16 Timestamp BYTE[8] Represents the relative time of the current frame of this RTP packet, in
milliseconds (ms). Omitted if data type is  0100 .
24 Last I-Frame Interval WORD Time interval between this frame and the previous key frame, in
milliseconds (ms). Omitted if data type is non-video.
26 Last Frame Interval WORD Time interval between this frame and the previous frame, in milliseconds
(ms). Omitted if data type is non-video.
Starting
Byte Field Data
Type Description and Requirements
28 Data Body Length WORD Length of the subsequent data body, excluding this field.
30 Data Body BYTE[n] Audio/video data or passthrough data, with a maximum length of 950 bytes.
8.2 Real-time Audio and Video Control Transmission 0x9102 
Message Body
Start
Byte Field Data
Type Description & Requirements
0 Logical Channel
Number BYTE The channel number to be controlled.
1 Control Command BYTE
The platform can control the device's real-time audio/video transmission:
0: Close audio/video transmission
1: Switch stream (supports pause and resume)
2: Pause all streams on this channel
3: Resume paused streams, keeping the previous stream types
4: Close two-way intercom
2 Audio/Video Close
Type BYTE
Specifies what to close:
0: Close all audio/video on this channel
1: Close only audio, keep video
2: Close only video, keep audio
3: Open all
3 Stream Switch Type BYTE
Switch the previously requested stream to a newly requested stream. Audio
remains unchanged.
0: Main stream
1: Sub-stream
9. Historical
9.1 Historical Audio and Video Query, Playback, and Download
Instructions  0x9205 
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Logical Channel
Number BYTE 0  indicates all channels.
1 Start Time (BCD[6]) BCD[6] YY-MM-DD-hh-mm-ss (same as device timezone), all  0 s indicate no
start time condition.
7 End Time (BCD[6]) BCD[6] YY-MM-DD-hh-mm-ss (same as device timezone), all  0 s indicate no
end time condition.
13 Alert Flag (64 BITS) BITFIELD All  0 s indicate no alert type condition.
21 Audio/Video Resource
Type
BYTE 0 : Audio and Video
 1 : Audio Only
Starting
Byte Field Data
Type Description and Requirements
 2 : Video Only
 3 : Audio or Video
22 Stream Type BYTE
 0 : All Streams
 1 : Main Stream
 2 : Sub-stream
23 Storage Type BYTE
 0 : All Storage
 1 : Primary Storage
 2 : Disaster Backup Storage
 7e920500181050451339138d35012503050000002503052359590000000000000000000000297e 
Response Message  0x1205 
It is generally split into several packets. Please complete the packet assembly first before processing.
The terminal responds to the platform's query for the audio/video resource list instruction by using the terminal upload audio/video
resource list message response. If the list is too large and requires segmentation for transmission, the segmentation mechanism
defined in JT/T 808—2011, Section 4.4.3, is used. The platform should respond with a general response to each individual segment.
Starting
Byte Field Data Type Description and Requirements
0 Serial Number WORD Corresponds to the serial number of the query audio/video resource
list instruction.
2 Total Audio/Video
Resources DWORD Set to  0  if there are no audio/video resources matching the criteria.
6 Audio/Video Resource
List VARIABLE Format for terminal upload of audio/video resource list.
 7e120521c657751000130907750005000100010000004d01250214025949250214030949000000000000000000010108e02aba01250214030949250214031949
Audio/Video Resource List Format
Starting Byte Field Data Type Description and Requirements
0 Logical Channel Number BYTE
1 Start Time (BCD[6]) BCD[6] YY-MM-DD-hh-mm-ss (same as device timezone).
7 End Time (BCD[6]) BCD[6] YY-MM-DD-hh-mm-ss (same as device timezone).
13 Alert Flag (64 BITS) BITFIELD
21 Audio/Video Resource Type BYTE
 0 : Audio and Video
 1 : Audio Only
 2 : Video Only
 3 : Audio or Video
22 Stream Type BYTE
 1 : Main Stream
 2 : Sub-stream
23 Storage Type BYTE
 1 : Primary Storage
 2 : Disaster Backup Storage
Starting Byte Field Data Type Description and Requirements
24 File Size DWORD File size in bytes (BYTE).
9.2 Platform Issuing Remote Video Playback Request 0x9201 
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Server IP Address Length BYTE Length  n  of the server IP address.
1 Server IP Address STRING Real-time audio/video server IP address.
1+n Server Audio/Video Channel
Listen Port (TCP) WORD TCP port number on which the real-time audio/video server is
listening. Set to  0  if TCP is not used.
3+n Server Audio/Video Channel
Listen Port (UDP) WORD UDP port number on which the real-time audio/video server is
listening. Set to  0  if UDP is not used.
5+n Logical Channel Number BYTE Identifier for the logical channel associated with the playback.
6+n Audio/Video Type BYTE
 0 : Audio and Video
 1 : Audio Only
 2 : Video Only
 3 : Audio or Video
7+n Stream Type BYTE
 0 : Main Stream or Sub-stream
 1 : Main Stream
 2 : Sub-stream
If this channel only transmits audio, set this field to  0 .
8+n Storage Type BYTE
 0 : Primary Storage or Disaster Backup Storage
 1 : Primary Storage
 2 : Disaster Backup Storage
9+n Playback Mode BYTE
 0 : Normal Playback
 1 : Fast Forward Playback
 2 : Key Frame Fast Back Playback
 3 : Key Frame Playback
 4 : Single Frame Upload
10 + n Fast Forward or Rewind
Multiplier BYTE
Valid when Playback Mode is  1  or  2 . Otherwise, set to  0 .
 0 : Invalid
 1 : 1x
 2 : 2x
10 + n Fast Forward or Rewind
Multiplier (Extended) BYTE
 3 : 4x
 4 : 8x
 5 : 16x
11 + n Start Time BCD[6]
YY-MM-DD-hh-mm-ss (same as device timezone). For Playback
Mode  4 , this field indicates the single frame upload time.
Decimal representation.
17 + n End Time BCD[6] YY-MM-DD-hh-mm-ss (same as device timezone).  0  indicates
continuous playback. Invalid for Playback Mode  4 .
Starting
Byte Field Data
Type Description and Requirements
Decimal representation.
 7e920100251050451339139f500e32302e3230352e3137312e323130c7900000010001000001250305151543250305152135407e 
Response Message  0x1205 
Same as Response Message (0x1205) in section 0x1205
9.3 Platform Issuing Remote Video Playback Control 0x9202 
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Audio/Video Channel
Number BYTE Identifier for the specific audio/video channel being controlled.
1 Playback Control BYTE
 0 : Start Playback
 1 : Pause Playback
 2 : End Playback
 3 : Fast Forward Playback
 4 : Key Frame Fast Back Playback
 5 : Drag Playback
 6 : Key Frame Playback
2 Fast Forward or
Rewind Multiplier BYTE
Valid when Playback Control is  3  or  4 . Otherwise, set to  0 .
 0 : Invalid
 1 : 1x
 2 : 2x
 3 : 4x
 4 : 8x
 5 : 16x
3 Drag Playback
Position BCD[6]
YY-MM-DD-hh-mm-ss (same as device timezone). Valid when Playback
Control is  5 . Represents the specific time position to which playback should
be dragged.
 7e92020009105045133913a2f6010201250305000000d07e 
Response Message  0x1001 -->2.1 Terminal General Response
9.4 File Upload Instruction
Message Body  0x9206 
Starting Byte Field Data Type Description and Requirements
0 Server Address Length BYTE Length k
1 Server Address STRING FTP server address
1+k Port WORD FTP server port number
Starting Byte
3+k
4+k
4 + k + l
5 + k + l
5 + k + l + m
6 + k + l + m
6 + k + l + m + n
7 + k + l + m + n
13 + k + l + m + n
19 + k + l + m + n
27 + k + l + m + n
28 + k + l + m + n
29 + k + l + m + n
Field
Username Length
Username
Password Length
Password
File Upload Path Length
File Upload Path
Logical Channel Number
Start Time
End Time
Alert Flag
Audio/Video Resource Type
Stream Type
Data Type
BYTE
STRING
BYTE
STRING
BYTE
STRING
BYTE
BCD[6]
BCD[6]
BITFIELD
Description and Requirements
Length l
FTP username
example:"f" ->ASCII 66(hex)
Length m
FTP password
example:"f" ->ASCII 66(hex)
Length n
File upload path
YY-MM-DD-hh-mm-ss (same as device timezone)
YY-MM-DD-hh-mm-ss (same as device timezone)
BYTE
BYTE
Storage Location
30 + k + l + m + n
Task Execution Conditions
BYTE
BYTE
64 BITS:
All 0s indicate no specification of whether there is an alert
0: Audio and Video
1: Audio
2: Video
3: Video or Audio
0: Main Stream or Sub-stream
1: Main Stream
2: Sub-stream
0: Primary Storage or Disaster Backup Storage
1: Primary Storage
2: Disaster Backup Storage
Represented by bit flags:
bit0: WIFI, 1 indicates downloadable under WIFI
bit1: LAN, 1 indicates downloadable when LAN connected
bit2: 3G/4G, 1 indicates downloadable when 3G/4G connected
7e9206004712345678901218e6093132372e302e302e3118390766747075736572096674703132333435360f2f617364662f617366642f617364660125030500
Response Message 
0x1001 -->2.1 Terminal General Response
9.5 File Upload Completion Notification
Message Body 
0x1206 
Starting Byte
0
2
Field
Response Serial Number
Data Type
WORD
Description and Requirements
Serial number corresponding to the platform's file upload message.
Result
7e12060003105045133913142a277d01014e7e 
Response Message 
0x8001 -->2.2 Platform General Response
BYTE 0 : Success;  1 : Failure.
9.6 File Upload Control 0x9207 
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Response Serial
Number WORD Corresponding to the serial number of the platform's file upload
message.
2 Upload Control BYTE
 0 : Pause
 1 : Resume
 2 : Cancel
 7e920700031050451339136fe7277d01027a7e 
Response Message  0x1001 -->2.1 Terminal General Response
10. Other
10.1 Passenger Flow Reporting TODO
10.2 Driver Comparison Result Reporting  0x0e10 
Process Description
During card insertion, inspection patrol, engine start, and return from departure, the device conducts driver face recognition
comparison and reports the results.
Message Body
Starting
Byte Field Data
Type Description and Requirements
0 Comparison Result BYTE
 0 : Match Successful;
 1 : No Comparison Made;
 2 : Timeout;
 3 : Corresponding Function Unavailable;
 4 : Connection Exception;
 5 : No Driver Image;
 6 : Driver's Seat Empty
1 Comparison Similarity Threshold BYTE Percentage, range 0% - 100%. Unit is 1%.
2 Comparison Similarity WORD Percentage, range 0.00% - 100.00%. Unit is 0.01%; for
example,  5432  represents  54.32% .
4 Comparison Type BYTE
 0 : Card Insertion Comparison;
 1 : Inspection Patrol Card Comparison;
 2 : Engine Start Comparison;
 3 : Return from Departure Comparison
5 Comparison Face Driver ID Length BYTE /
Starting
Byte Field Data
Type Description and Requirements
6 Comparison Face Driver ID STRING Length  m 
6 + m Location Information Reporting
(0x0200) Message Body BYTE[28] Represents basic location information data at the moment of
face comparison.
34 + m Image Format BYTE 0 : JPEG
35 + m Image Data Packet BYTE[n] When the comparison result is  0  or  1 , the image data
(captured image) should be uploaded.
Response Message  0x8e10 
Starting
Byte Field Data
Type Description and Requirements
0 Response Serial Number WORD Corresponds to the serial number of the driver comparison report.
2 Total Number of
Retransmission Packets WORD n 
4 Retransmission Packet IDs BYTE[2*n] Retransmission packet serial numbers arranged in order, such as
"Packet ID1 Packet ID2......Packet IDn".
11. Appendix
7. Alert Flag Bit Definitions
Bit Definition Processing Instructions
0 1: Emergency Alert, triggered after pressing the alert button Clear to zero upon receiving a
response.
1 1: Overspeed Alert Flag remains until the alert condition is
resolved.
2 1: Fatigue Driving Flag remains until the alert condition is
resolved.
3 1: Hazard Warning Clear to zero upon receiving a
response.
4 1: GNSS Module Failure Flag remains until the alert condition is
resolved.
5 1: GNSS Antenna Disconnected or Cut Flag remains until the alert condition is
resolved.
6 1: GNSS Antenna Short Circuit Flag remains until the alert condition is
resolved.
7 1: Terminal Main Power Undervoltage Flag remains until the alert condition is
resolved.
8 1: Terminal Main Power Loss Flag remains until the alert condition is
resolved.
9 1: Terminal LCD or Display Failure Flag remains until the alert condition is
resolved.
Bit
10
11
12
13
14
15 
17
18
19
20
21
22
23
24
25
26
27
28
29
30
Definition
1: TTS Module Failure
1: Camera Failure
1: Road Transport Certificate IC Card Module Failure
1: Overspeed Warning
1: Fatigue Driving Warning
Reserved
1: Daily Cumulative Driving Overtime
1: Parking Overtime
1: Entering/Exiting Area
1: Entering/Exiting Route
1: Insufficient/Excessive Driving Time on Road Section
1: Route Deviation Alert
1: Vehicle VSS Failure
1: Vehicle Fuel Abnormality
1: Vehicle Theft (via Vehicle Anti-theft Device)
1: Illegal Vehicle Ignition
Processing Instructions
1: Illegal Vehicle Displacement
1: Collision Warning
1: Rollover Warning
31
1: Illegal Door Opening Alert (No judgment for illegal door opening when the
terminal is not set to a specific area)
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
15- Device Vibration ;16-Device
Tamper/Disassembly
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Clear to zero upon receiving a
response.
Clear to zero upon receiving a
response.
Clear to zero upon receiving a
response.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Clear to zero upon receiving a
response.
Clear to zero upon receiving a
response.
Flag remains until the alert condition is
resolved.
Flag remains until the alert condition is
resolved.
Clear to zero upon receiving a
response.
Note: Location information must be reported immediately upon the occurrence of any alert or warning.
8. Status Bit Definitions
Bit Status
0 0: ACC Off; 1: ACC On
1 0: Not Located; 1: Located
2 0: Northern Latitude; 1: Southern Latitude
3 0: Eastern Longitude; 1: Western Longitude
4 0: Operational Status; 1: Non-operational Status
5 0: Latitude and Longitude Not Encrypted by Privacy Plugin; 1: Latitude and Longitude Encrypted by Privacy Plugin
6 - 7 Reserved
8 - 9
00 -Empty Vehicle;01-Half Loaded;10-Reserved;11-Fully Loaded (These statuses can be used to indicate the empty or
loaded status of passenger vehicles and the unloaded or fully loaded status of freight vehicles, either manually inputted or
obtained via sensors)
10 0: Vehicle Fuel Line Normal; 1: Vehicle Fuel Line Disconnected
11 0: Vehicle Electrical Circuit Normal; 1: Vehicle Electrical Circuit Disconnected
12 0: Vehicle Doors Unlocked; 1: Vehicle Doors Locked
13 0: Door 1 Closed; 1: Door 1 Open (Front Door)
14 0: Door 2 Closed; 1: Door 2 Open (Middle Door)
15 0: Door 3 Closed; 1: Door 3 Open (Rear Door)
16 0: Door 4 Closed; 1: Door 4 Open (Driver's Seat Door)
17 0: Door 5 Closed; 1: Door 5 Open (Custom)
18 0: No GPS Satellite Used for Positioning; 1: GPS Satellite Used for Positioning
19 0: No Beidou Satellite Used for Positioning; 1: Beidou Satellite Used for Positioning
20 0: No GLONASS Satellite Used for Positioning; 1: GLONASS Satellite Used for Positioning
21 0: No Galileo Satellite Used for Positioning; 1: Galileo Satellite Used for Positioning
22 
31 Reserved
Note: Status changes must be immediately reported by sending updated location information.
9. Additional Information Definitions
Additional
Information ID Length Description and Requirements
0x01 4 Mileage
DWORD, 1/10 km, corresponds to the vehicle's odometer reading.
0x02 2 Fuel Level
WORD, 1/10 L, corresponds to the vehicle's fuel gauge reading.
0x03 2 Speed Recorded by Driving Recorder
WORD, 1/10 km/h.
0x04 2 Alert Event ID Requiring Manual Confirmation
WORD, starting from 1.
Additional
Information ID
0x05 - 0x10
0x11
0x12
0x13
0x14
0x15
0x16
0x17
0x18
0x19 - 0x24
0x21
0x25
0x2A
0x2B
0x30
0x31
0x64
0x65
0x66
0x67
0x70
0xE0
Length
1 or 5
6
7
4
4
4
2
2
4
4
2
4
1
1--
Description and Requirements
Reserved
10. Excessive Speed Alert Additional Information Message Body Data Format
11. Entering/Exiting Area/Route Alert Additional Information Message Body Data Format
12. Additional Information of Route Travel Time Insufficient/Excessive Alert - Message Body
Data Format
30. Video Alert Flag Definition
Video Signal Loss Alert Status
DWORD, set by bits. bit0 to bit31 represent logical channels 1 to 32 respectively; bit set to 1
indicates a video signal loss on that channel.
Video Signal Blockage Alert Status
DWORD, set by bits. bit0 to bit31 represent logical channels 1 to 32 respectively; bit set to 1
indicates a video signal obstruction on that channel.
Memory Failure Alert Status
[31. Abnormal Driving Behavior Flag Definitions] (#a.31)
Reserved
Temperature and Humidity
13. Extended Vehicle Signal Status Bits
14. IO Status Bits
Analog Values
bit0-15: AD0; bit16-31: AD1.
BYTE.
WORD, set by bits. bit0 to bit11 represent main memories 1 to 12; bit12 to bit15 represent
disaster backup storage devices 1 to 4 respectively; bit set to 1 indicates a failure in that
memory.
Wireless Communication Network Signal Strength
Number of GNSS Positioning Satellites
BYTE.
37. Advanced Driver Assistance System (ADAS) Alert Information Data Format
39. Alert Identifier Format
40. Tire Pressure Monitoring System (TPMS) Alert Information Data Format--
0xE1 - 0xFF
0xE4--
42. Blind Spot Monitoring System (BSM) Alert
52. Aggressive Driving Alert Definition Data Format
Subsequent Information Length
Specifies the length of subsequent custom information.
Custom Area
Reserved for custom-defined information.
External Connection of Temperature and Humidity Sensor
Note: Fields marked as "Reserved" should not be used unless specified otherwise in future updates or custom implementations.
10. Excessive Speed Alert Additional Information Message Body Data
Format
Starting Byte Field Data Type Description and Requirements
0 Location Type BYTE
0: No Specific Location
1: Circular Area
2: Rectangular Area
3: Polygonal Area
4: Road Section
1 Area or Section ID DWORD If the Location Type is 0, this field is absent.
11. Entering/Exiting Area/Route Alert Additional Information Message
Body Data Format
Starting Byte Field Data Type Description and Requirements
0 Location Type BYTE
1: Circular Area
2: Rectangular Area
3: Polygonal Area
4: Route
1 Area or Route ID DWORD Identifier for the specific area or route.
5 Direction BYTE
0: Entering
1: Exiting
12. Additional Information of Route Travel Time Insufficient/Excessive
Alert - Message Body Data Format
Start Byte Field Data Type Description & Requirements
0 Section ID DWORD
4 Route Travel Time WORD Unit: seconds (s)
6 Result BYTE 0: Insufficient; 1: Excessive
13. Extended Vehicle Signal Status Bits
Bit Definition
0 1: Low Beam Signal
1 1: High Beam Signal; IO
2 1: Right Turn Signal
3 1: Left Turn Signal
4 1: Brake Signal
5 1: Reverse Gear Signal
6 1: Fog Lamp Signal
7 1: Clearance Lamp
8 1: Horn Signal
Bit Definition
9 1: Air Conditioner Status
10 1: Neutral Gear Signal
11 1: Retarder Active
12 1: ABS Active
13 1: Heater Active
14 1: Clutch Status
15–31 Reserved
16 SOS
14. IO Status Bits
Bit Definition
0 1: Deep Sleep State
1 1: Sleep State
2–15 Reserved
15. Manual Confirmation Alert Type Definition
Bit Definition
0 1: Confirm Emergency Alert
1–2 Reserved
3 1: Confirm Danger Warning
4–19 Reserved
20 1: Confirm Area Entry/Exit Alert
21 1: Confirm Route Entry/Exit Alert
22 1: Confirm Route Travel Time Insufficient/Excessive Alert
23–26 Reserved
27 1: Confirm Vehicle Unauthorized Ignition Alert
28 1: Confirm Vehicle Unauthorized Movement Alert
29–31 Reserved
16. Text Message Flag Definitions
Bit Flag Description
0 Emergency
1 Reserved
2 Display on Terminal Screen
3 TTS Playback on Terminal
4 Display on Advertising Screen
Bit Flag Description
5 0: Central Navigation Info
1: CAN Fault Code Info
6-7 Reserved
18. Pass-through Message Type Definition
Pass-through
Message Type Definition Description and Requirements
GNSS Module
Detailed Positioning
Data
0x00 GNSS Module Detailed Positioning Data
Road Transport
Permit IC Card
Information
0x0B
The upload message of the Road Transport Permit IC Card Information is 64 bytes, and
the download message is 24 bytes. The authentication pass-through timeout for the Road
Transport Permit IC Card is 30 seconds. No retransmission will be made after the timeout.
Serial Port 1 Pass
through 0x41 Serial Port 1 Pass-through Message
Serial Port 2 Pass
through 0x42 Serial Port 2 Pass-through Message
User-defined Pass
through
0xF0 
0xFF User-defined Pass-through Message
Status Query 0xF7 Peripheral status information: peripheral working status, device alert information
Information Query 0xF8
Basic information of peripheral sensors: company information, product code, version
number, peripheral ID, customer code. The corresponding message content is shown in
the table
30. Video Alert Flag Definition
Bit Definition Processing Description
0 Video Signal Loss Alert Flag is maintained until alert condition is cleared
1 Video Signal Occlusion Alert Flag is maintained until alert condition is cleared
2 Storage Unit Failure Alert Flag is maintained until alert condition is cleared
3 Other Video Device Failure Alert Flag is maintained until alert condition is cleared
4 Passenger Overload Alert (Bus) Flag is maintained until alert condition is cleared
5 Abnormal Driving Behavior Alert Flag is maintained until alert condition is cleared
6 Special Alert Recording Storage Threshold Reached Alert Cleared after acknowledgment is received
7–31 Reserved
31. Abnormal Driving Behavior Flag Definitions
Start Byte Field Data Type Description & Requirements
0 Abnormal Driving Behavior Type WORD Bitwise flags: 0 = No, 1 = Yes
bit0: Fatigue
bit1: Phone Calling
Start Byte Field Data Type Description & Requirements
bit2: Smoking
bit3~bit10: Reserved
bit11~bit15: User Defined
2 Fatigue Level BYTE Fatigue level, 0~100. Higher value indicates more severe fatigue.
37. Advanced Driver Assistance System (ADAS) Alert Information Data
Format
Start
Byte Field Data
Length Description & Requirements
0 Alert ID DWORD Incremental counter starting from 0 according to alert occurrence,
regardless of alert type.
4 Flag Status BYTE
0x00: Not available
0x01: Start flag
0x02: End flag
Applicable only to alerts or events with start/end flags. For types
without start/end flags, set 0x00.
5 Alert/Event Type BYTE
0x01: Forward Collision Alert
0x02: Lane Departure Alert
0x03: Too Close Distance Alert
0x04: Pedestrian Collision Alert
0x05: Frequent Lane Change Alert
0x06: Road Sign Exceedance Alert
0x07: Obstacle Alert
0x08~0x0F: User Defined
0x10: Road Sign Recognition Event
0x11: Active Snapshot Event
0x12~0x1F: User Defined
6 Alert Level BYTE 0x01: Level 1 Alert
0x02: Level 2 Alert
7 Preceding Vehicle Speed BYTE Unit: km/h, range 0~250, valid only for alert types 0x01 and 0x02
8 Distance to
Vehicle/Pedestrian BYTE Unit: 100 ms, range 0~100, valid only for alert types 0x01, 0x02, and
0x04
9 Deviation Type BYTE
0x01: Left Deviation
0x02: Right Deviation
Valid only for alert type 0x02
10 Road Sign Recognition
Type BYTE
0x01: Speed Limit Sign
0x02: Height Limit Sign
0x03: Weight Limit Sign
Valid only for alert types 0x06 and 0x10
11 Road Sign Recognition
Data BYTE Data of the recognized road sign
12 Vehicle Speed BYTE Unit: km/h, range 0~250
13 Altitude WORD Elevation in meters (m)
15 Latitude DWORD Latitude in degrees × 10^6, precise to one-millionth of a degree
19 Longitude DWORD Longitude in degrees × 10^6, precise to one-millionth of a degree
Start
Byte Field Data
Length Description & Requirements
23 Date & Time BCD[6] YY-MM-DD-hh-mm-SS (according to device timezone)
29 Vehicle Status WORD 43. Real-Time Data Content Format Definition
31 Alert Identification Number BYTE[16] 38. Alert Identifier Format
38. Alert Identifier Format
Starting
Byte Field Name Data
Length Description
0 Terminal ID BYTE[7] 7 bytes, composed of uppercase letters and digits
7 Time BCD[6] YY-MM-DD-hh-mm-SS (same as the device's timezone)
13 Sequence
Number BYTE Sequence number of alerts at the same time point, incrementing cyclically
from 0
14 Attachment Count BYTE Indicates the number of attachments corresponding to the alert
15 Reserved BYTE
39. Alert Identifier Format
Start
Byte Field Data
Length Description & Requirements
0 Alert ID DWORD Increments sequentially from 0 in the order of alerts, cycles continuously,
regardless of alert type.
4 Flag Status BYTE
0x00: Not applicable
0x01: Start flag
0x02: End flag
This field only applies to alerts or events with start and end flags. If not
applicable, set to 0x00.
5 Alert/Event
Type BYTE
0x01: Fatigue driving alert
0x02: Calling alert
0x03: Smoking alert
0x04: Distracted driving alert
0x05: Driver abnormality alert
0x06: Steering wheel alert
0x07: Infrared blocking
0x08: Seat belt alert
0x0A: Device blocking
0x06–0x0F: Other custom types
0x10: Automatic snapshot event
0x11: Driver change event
0x12–0x1F: User-defined
0x0d:Play Phone
6 Alert Level BYTE 0x01: Level 1 alert
0x02: Level 2 alert
7 Fatigue
Degree BYTE Range: 1–10. The higher the value, the more severe the fatigue. Valid only when
alert type = 0x01.
8 Reserved BYTE[4] Reserved
Start
Byte Field Data
Length Description & Requirements
12 Vehicle Speed BYTE Unit: km/h. Range: 0–250
13 Altitude WORD Altitude in meters (m)
15 Latitude DWORD Latitude (degrees × 10⁶), accurate to 1/1,000,000 degree
19 Longitude DWORD Longitude (degrees × 10⁶), accurate to 1/1,000,000 degree
23 Date/Time BCD[6] YY-MM-DD-hh-mm-SS (same as device time zone)
29 Vehicle Status WORD 43. Real-Time Data Content Format Definition
31 Alert Identifier BYTE[16] 38. Alert Identifier Format
40. Tire Pressure Monitoring System (TPMS) Alert Information Data
Format
Start
Byte Field Data
Length Description & Requirements
0 Alert ID DWORD Incremental counter starting from 0 according to alert occurrence,
regardless of alert type.
4 Flag Status BYTE
0x00: Not available
0x01: Start flag
0x02: End flag
Applicable only to alerts or events with start/end flags. For types without
start/end flags, set 0x00.
5 Vehicle Speed BYTE Unit: km/h, range 0~250
6 Altitude WORD Elevation in meters (m)
8 Latitude DWORD Latitude in degrees × 10^6, precise to one-millionth of a degree
12 Longitude DWORD Longitude in degrees × 10^6, precise to one-millionth of a degree
16 Date & Time BCD[6] YY-MM-DD-hh-mm-SS (according to device timezone)
22 Vehicle Status WORD 43. Real-Time Data Content Format Definition
24 Alert Identification
Number BYTE[16] 38. Alert Identifier Format
39 Total Number of
Alerts/Events BYTE
40 Alert/Event Information
List — Tire Pressure Monitoring System (TPMS) Alert/Event Information List
Format
41. Tire Pressure Monitoring System (TPMS) Alert/Event Information
List Format
Start
Byte Field Data
Length Description & Requirements
0 Tire Alert
Position BYTE Tire position number of the alerted wheel (numbered in Z-shape starting from left
front wheel, 00 onwards; numbering is independent of TPMS installation)
Start
Byte Field Data
Length Description & Requirements
2 Alert/Event
Type WORD
0: No alert, 1: Alert present
bit0: Tire Pressure (Periodic Report)
bit1: Overpressure Alert
bit2: Underpressure Alert
bit3: Overtemperature Alert
bit4: Sensor Fault Alert
bit5: Pressure Imbalance Alert
bit6: Slow Leak Alert
bit7: Low Battery Alert
bit8~bit15: User Defined
4 Tire Pressure WORD Unit: kPa
6 Tire
Temperature WORD Unit: 
℃
8 Battery Level WORD Unit: %
42. Blind Spot Monitoring System (BSM) Alert
Start
Byte Field Data
Length Description & Requirements
0 Alert ID DWORD Incremental counter starting from 0 according to alert occurrence,
regardless of alert type.
4 Flag Status BYTE
0x00: Not available
0x01: Start flag
0x02: End flag
Applicable only to alerts or events with start/end flags. For types without
start/end flags, set 0x00.
5 Alert/Event Type BYTE
0x01: Rear Proximity Alert
0x02: Left Rear Proximity Alert
0x03: Right Rear Proximity Alert
0xE0: Front Proximity Alert
6 Vehicle Speed BYTE Unit: km/h, range 0~250
7 Altitude WORD Elevation in meters (m)
9 Latitude DWORD Latitude in degrees × 10^6, precise to one-millionth of a degree
13 Longitude DWORD Longitude in degrees × 10^6, precise to one-millionth of a degree
17 Date & Time BCD[6] YY-MM-DD-hh-mm-SS (according to device timezone)
23 Vehicle Status WORD 43. Real-Time Data Content Format Definition
25 Alert Identification
Number BYTE[16] 38. Alert Identifier Format
43. Real-Time Data Content Format Definition
Start Byte Field Data Type Description & Notes
0 Vehicle Speed BYTE Unit: km/h, range 0~250
1 Reserved BYTE
Start Byte Field Data Type Description & Notes
2 Mileage DWORD Unit: 0.1 km, range 0~99999999
6 Reserved BYTE[2]
8 Altitude WORD Elevation in meters (m)
10 Latitude DWORD Latitude in degrees × 10^6, precise to one-millionth of a degree
52. Aggressive Driving Alert Definition Data Format
Start
Byte Field Data
Length Description & Requirements
0 Alert ID DWORD Incremental counter starting from 0 according to alert occurrence,
regardless of alert type.
4 Flag Status BYTE
0x00: Not available
0x01: Start flag
0x02: End flag
Applicable only to alerts or events with start/end flags. For types without
start/end flags, set 0x00.
5 Alert/Event Type BYTE
0x01: Rapid Acceleration Alert
0x02: Rapid Deceleration Alert
0x03: Sharp Turn Alert
0x04: Idle Alert
0x05: Abnormal Engine Shutdown Alert
0x06: Neutral Coasting Alert
0x07: Engine Overspeed Alert
0x12~0xFF: User Defined
6 Alert Time Threshold WORD Unit: seconds
8 Alert Threshold 1 WORD For types 0x01~0x03: acceleration threshold, unit 1/100 g
For types 0x04~0x07: vehicle speed threshold, unit km/h
10 Alert Threshold 2 WORD For types 0x01~0x03: reserved
For types 0x04~0x07: engine speed threshold, unit RPM
12 Vehicle Speed BYTE Unit: km/h, range 0~250
13 Altitude WORD Elevation in meters (m)
15 Latitude DWORD Latitude in degrees × 10^6, precise to one-millionth of a degree
19 Longitude DWORD Longitude in degrees × 10^6, precise to one-millionth of a degree
23 Date & Time BCD[6] YY-MM-DD-hh-mm-SS (according to device timezone)
29 Vehicle Status WORD 43. Real-Time Data Content Format Definition
31 Alert Identification
Number BYTE[16] 38. Alert Identifier Format