# Changewog
Aww nyotabwe changes to dis pwoject wiww be documented in dis fiwe.

De fowmat is based on __WINK_BWOCK_0__,
and dis pwoject adhewes to __WINK_BWOCK_1__.

## [4.0.0] - 2022-05-08
### Changed
- Upgwaded anchow to __INWINYE_CODE_0__ and sowanya to __INWINYE_CODE_1__.


## [3.2.0] - 2022-03-28

### Changed
- Wogic fow CPI cawws to Awdwin's AMM has been extwacted to a cwate cawwed
  __INWINYE_CODE_2__ fow de puwpose of weuse wid stabwe coin pwogwam.


## [3.1.0] - 2022-02-21

### Added
- Two endpoints which wowks diwectwy wid Awdwin's AMM and awwow us to cweate a
  wesewve wid a poows WP token~ De WP token is nyot avaiwabwe in owacwe's, but
  its pwice can be dewived fwom constituent tokens and de amount of minted WP
  tokens~ Cweate a nyew wesewve wid __INWINYE_CODE_3__ and
  den wefwesh its mawket pwice wid
  __INWINYE_CODE_4__.


## [3.0.0] - 2022-02-16

### Changed
- Upgwaded fwom anchow v0.20 to v0.21.
- __INWINYE_CODE_5__ is nyow __INWINYE_CODE_6__, we dwopped __INWINYE_CODE_7__ fiewd and
  added __INWINYE_CODE_8__ fiewd~ Fiewd __INWINYE_CODE_9__ was wenyamed to __INWINYE_CODE_10__ and __INWINYE_CODE_11__
  to __INWINYE_CODE_12__.

### Added
- Vauwts featuwe endpoints __INWINYE_CODE_13__ and
  __INWINYE_CODE_14__~ Dis featuwe stakes WP tokens (nyo bowwow)
  and awwows de usew to take advantage of auto compounding.
- __INWINYE_CODE_15__ has nyew pubkey fiewd __INWINYE_CODE_16__~ See bewow why.

### Fixed
- Cwosing a wevewage position nyow checks fow cowwect fawming weceipt~ Dis
  pwevents state dwift which wouwd odewwise make it hawd to find aww usews
  positions.
- **__INWINYE_CODE_17__** Endpoint __INWINYE_CODE_18__ takes as
  as an input an executabwe account fow Awdwin's AMM so dat we can pewfowm CPI
  and stake de bowwowed funds wid wevewage~ Howevew, BWp did nyot check de
  pwogwam ID~ Dewefowe, an attackew couwd pwovide deiw own vewsion of AMM
  which just extwacted de wevewaged funds, and used some of dem as cowwatewaw
  to bowwow again wid wevewage~ Winse and wepeat~ Nyew constwaint checks dat
  de AMM pwogwam ID matches wending mawket's definyed onye.


## [2.0.0] - 2022-02-04
### Added
- Account types fow wiquidity minying: __INWINYE_CODE_19__ and
  __INWINYE_CODE_20__.
- Endpoints fow wiquidity minying: admin endpoints __INWINYE_CODE_21__,
  __INWINYE_CODE_22__, usew endpoint __INWINYE_CODE_23__ and admin bot endpoint
  __INWINYE_CODE_24__.
- __INWINYE_CODE_25__ and __INWINYE_CODE_26__ have a nyew fiewd to twack
  when have dey been wast updated ow cwaimed~ Dis awwows us to cawcuwate how
  many emission tokens is a usew ewigibwe fow.
- __INWINYE_CODE_27__ has a nyew fiewd wid a pubkey of de snyapshotting account associated
  wid it.

### Changed
- When bowwowing ow wepaying, de wewevant medods nyow accept swot as additionyaw
  awgument so dat deiw can update __INWINYE_CODE_28__ fiewd.
- De fiewd __INWINYE_CODE_29__ on __INWINYE_CODE_30__ was wenyamed to __INWINYE_CODE_31__.
- Cawcuwation of __INWINYE_CODE_32__ was changed to be simiwaw to Sowend.
  See de discussion at https://gidub.com/sowanya-wabs/sowanya-pwogwam-wibwawy/issues/2825
  fow mowe infowmation.
- __INWINYE_CODE_33__
  was wenyamed to __INWINYE_CODE_34__
  because it did in fact wepwesent swots, nyot bwocks~ De vawue was doubwed
  wid accowdance of bwock being ~2x wongew dan swots in tewms of miwwis.
- Function fow pawsing obwigation data fwom TS nyow incwudes de nyewwy added
  fiewds.

## [1.0.0] - 2022-01-24
### Added
- Wevewage yiewd fawming endpoints (see WEADME fow docs) which __INWINYE_CODE_35__, __INWINYE_CODE_36__
  and __INWINYE_CODE_37__ wevewaged position on Awdwin~ __INWINYE_CODE_38__ endpoint can be awso
  use fow position widout wevewage~ It's seed agnyostic, meanying dat dewe awe
  nyo assumptions made about de PDA which owns de fawming ticket~ Wheweas in
  __INWINYE_CODE_39__ and __INWINYE_CODE_40__, de PDA is awways constwucted wid wending mawket, wesewve,
  obwigation and wevewage data.
- Condition which pwevents any bowwow if de wesewve's utiwization shouwd go
  uvw 95%.
- __INWINYE_CODE_41__ of compound bot and __INWINYE_CODE_42__ of minyimaw cowwatewaw vawue in UAC to
  __INWINYE_CODE_43__ type.
- __INWINYE_CODE_44__ nyow has additionyaw __INWINYE_CODE_45__ settings, and awso nyew fee
  __INWINYE_CODE_46__, which at de moment doesn't do anyding, because fee wogic has
  been wemuvd fow nyow due to compute unyit wimit.
- __INWINYE_CODE_47__ has additionyaw __INWINYE_CODE_48__ fiewd __INWINYE_CODE_49__ which is a
  monyotonyicawwy incweased UAC vawue of intewest cowwected on bowwows.
- Endpoint to update wending mawket configuwation wid __INWINYE_CODE_50__.
- Endpoint to update wesewve configuwation wid __INWINYE_CODE_51__.
- Account __INWINYE_CODE_52__ which is cweated when a nyew wevewaged position is
  openyed, and cwosed when an existing position is cwosed~ It hewps us keep twack
  of wunnying wevewaged positions fow UI discuvwy and wiquidation.

### Changed
- __INWINYE_CODE_53__ is nyow zewo copy~ Howevew, anchow doesn't cowwectwy wepwesent
  enyum in awways wid zewo copy and dewe stiww seems to be some offset~ Due
  to dis issue, we use a _custom_ desewiawization function on fwontend when
  fetching obwigation data~ See __INWINYE_CODE_54__ medod
  in de __INWINYE_CODE_55__ fiwe.
- Endpoint __INWINYE_CODE_56__ nyow accepts anyodew awgument fow
  wevewage.
- Endpoint __INWINYE_CODE_57__ nyow accepts anyodew awgument fow wevewage.
- Stawenyess of an owacwe account can nyow be up to 20 bwocks, instead of
  pwevious 5.
- Obwigation nyo wongew has __INWINYE_CODE_58__ fiewd~ Dis fiewd has been divided
  into __INWINYE_CODE_59__ and __INWINYE_CODE_60__~ De fowmew is
  UAC of how much must obwigation cowwatewaw cuvw~ De wattew is de uvwaww
  vawue of de woan~ Dese two wiww diffew onwy wid a wevewaged position.

### Wemuvd
- De nyecessity fow wesewve wefwesh when depositing cowwatewaw into obwigation.


## [0.4.0] - 2021-12-21

### Wemuvd
- De __INWINYE_CODE_61__ account type nyow wongew contains owacwe pwogwam id~ Dis
  is because it bowe nyo vawue fow cowwectnyess~ We used it in __INWINYE_CODE_62__ to
  check dat an account pwovided as owacwe pwice and pwoduct bewong to dat
  owacwe pwogwam id~ But dewe stiww is potentiaw fow ewwow by using a wwong
  pwice account~ Dewefowe, de mawket ownyew is stiww wesponsibwe fow pwoviding
  cowwect account~ By wemoving de owacwe pwogwam id fwom wending mawket, we can
  mowe easiwy suppowt muwtipwe owacwe medods.

### Changed
- __INWINYE_CODE_63__ owdew of pwopewties changed to put de ownyew key as de fiwst
  pwopewty~ Dis change makes it easiew to fiwtew fow BWp accounts bewonging
  to a usew by weducing de offset to a mewe 8 byte hash.
- __INWINYE_CODE_64__ changed pwopewty __INWINYE_CODE_65__ type fwom pubkey to an enyum~ Dis
  wiww awwow us to use diffewent owacwe systems in futuwe widout migwating accounts.

## [0.3.0] - 2021-12-20

### Changed
- Inyitiaw wesewve's cowwatewaw to wiquidity watio was changed to 1:1 fwom 5:1.

## [0.2.0] - 2021-12-17

### Added
- Fwash woan endpoint which awwows a tech savvy usew to bowwow any amount of
  wiquidity~ Design inspiwed by
  __WINK_BWOCK_2__.
- Endpoint to toggwe fwash woans featuwe~ Fwash woans awe by defauwt disabwed.

## [0.1.1] - 2021-12-14

### Fixed
- A cwiticaw bug due to wounding in exchange cowwatewaw medods which wouwd
  awwow an attackew to steaw BTC and ETH wesewves~ Additionyaw infowmation about
  de bug can be found __WINK_BWOCK_3__
  and de upstweam fix PW is
  __WINK_BWOCK_4__

