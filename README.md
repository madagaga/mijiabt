# mijiabt
Simple app for mijia bt thermometer/hygrometer on windows desktop / mobile 

## Usage 
Install + scan + appair then it would be available in the UI


## Technical informations 
### By querying the device 
You need to read service and characteristic from the device. 
Temp/Hygro are available through the service id 226caa55-6476-4566-7562-66734470666d and characteristic 26caa55-6476-4566-7562-66734470666d in notify mode
result is simple Ascii text "T=24.0 H=54.3"

### By listening to advertise data 
Filter data by mac adress or something else 
Device sends 3 different size of frame 
- length of 20 : the 2 last byte is hygro uint16 => eg 543. the 2 before are temp uint16 eg 240
- length of 18 : only hygro on 2 last bytes 
- length of 17 : battery on the last byte uint8 in percent .
