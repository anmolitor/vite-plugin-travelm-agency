module Main exposing (..)

import Browser
import Html
import Translations exposing (I18n)


type Msg
    = Msg --LoadedI18n (Result Http.Error (I18n -> I18n))


type alias Flags =
    ()


type alias Model =
    I18n


main : Program Flags Model Msg
main =
    Browser.document
        { init = \_ -> ( Translations.init Translations.En, Cmd.none )
        , update = \_ m -> ( m, Cmd.none )
        , subscriptions = \_ -> Sub.none
        , view = \i18n -> { title = "Vite Plugin", body = [ Html.text <| Translations.testMessage i18n ] }
        }
