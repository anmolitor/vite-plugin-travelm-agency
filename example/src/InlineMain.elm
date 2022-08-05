module InlineMain exposing (..)

import Browser
import Html exposing (Html)
import Html.Events
import InlineTranslations as Translations exposing (I18n, Language)


type Msg
    = SwitchLanguage Language


type alias Flags =
    ()


type alias Model =
    { i18n : I18n, activeLanguage : Language }


main : Program Flags Model Msg
main =
    Browser.document
        { init =
            \translations ->
                ( { i18n = Translations.init Translations.En
                  , activeLanguage = Translations.En
                  }
                , Cmd.none
                )
        , update =
            \msg model ->
                case msg of
                    SwitchLanguage lang ->
                        ( { model | activeLanguage = lang, i18n = Translations.load lang model.i18n }, Cmd.none )
        , subscriptions = \_ -> Sub.none
        , view =
            \{ i18n } ->
                { title = "Vite Plugin"
                , body =
                    [ Html.span [] [ Html.text <| Translations.testMessage i18n ]
                    ]
                        ++ List.map switchLanguageButton Translations.languages
                }
        }


switchLanguageButton : Language -> Html Msg
switchLanguageButton lang =
    Html.button [ Html.Events.onClick (SwitchLanguage lang) ] [ Html.text <| Translations.languageToString lang ]
